import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import type { RequestUser } from '../orders/order-registry.service';
import { ExternalKeysService } from '../system/external-keys.service';

export type GxApiRequest = Request & { user?: RequestUser };

function headerValue(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
  return String(raw ?? '').trim();
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function extractBearer(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return m?.[1]?.trim();
}

/**
 * GX contract: Authorization: Bearer {inbound key}.
 * Uses Config-managed inbound key (and env fallbacks).
 */
@Injectable()
export class GxBearerGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly keys: ExternalKeysService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const candidates = this.keys.getInboundCandidates();
    if (candidates.length === 0) {
      throw new ServiceUnavailableException(
        'GX inbound API is not configured (generate an Inbound key in Config)',
      );
    }

    const req = context.switchToHttp().getRequest<GxApiRequest>();
    const provided =
      extractBearer(headerValue(req.headers.authorization)) ||
      headerValue(req.headers['x-api-key']) ||
      '';

    if (!provided || !candidates.some((expected) => safeEqual(provided, expected))) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    const clientIdRaw = this.config.get<string>('EXTERNAL_API_CLIENT_ID') ?? '1';
    const clientId = Number.parseInt(clientIdRaw, 10);
    if (!Number.isFinite(clientId) || clientId < 1) {
      throw new ServiceUnavailableException('EXTERNAL_API_CLIENT_ID is invalid');
    }

    req.user = {
      id: 0,
      username: 'gx-external-api',
      role: 'client',
      client_id: clientId,
    };
    return true;
  }
}
