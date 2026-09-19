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

export type GxApiRequest = Request & { user?: RequestUser };

const PLACEHOLDER_KEYS = new Set([
  '',
  'generate-a-long-secret',
  'dev-external-api-key-change-me',
  'change-me',
]);

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
 * GX contract: Authorization: Bearer {GX_EXTERNAL_API_KEY}.
 * EXTERNAL_API_KEY is accepted as a fallback so one key can be shared.
 */
@Injectable()
export class GxBearerGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const keys = [
      this.config.get<string>('GX_EXTERNAL_API_KEY'),
      this.config.get<string>('EXTERNAL_API_KEY'),
    ]
      .map((k) => (k ?? '').trim())
      .filter((k) => k && !PLACEHOLDER_KEYS.has(k));

    if (keys.length === 0) {
      throw new ServiceUnavailableException(
        'GX inbound API is not configured (set GX_EXTERNAL_API_KEY or EXTERNAL_API_KEY)',
      );
    }

    const req = context.switchToHttp().getRequest<GxApiRequest>();
    const provided =
      extractBearer(headerValue(req.headers.authorization)) ||
      headerValue(req.headers['x-api-key']) ||
      '';

    if (!provided || !keys.some((expected) => safeEqual(provided, expected))) {
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
