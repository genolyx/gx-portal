import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { RequestUser } from '../../orders/order-registry.service';

export type ApiKeyRequest = Request & { user?: RequestUser };

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ApiKeyRequest>();
    const expected = this.config.get<string>('EXTERNAL_API_KEY')?.trim();
    if (!expected) {
      throw new UnauthorizedException('External API key is not configured');
    }

    const provided =
      (typeof req.headers['x-api-key'] === 'string' && req.headers['x-api-key']) ||
      extractBearerApiKey(req.headers.authorization);

    if (!provided || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    const clientIdRaw = this.config.get<string>('EXTERNAL_API_CLIENT_ID');
    const clientId = clientIdRaw ? Number(clientIdRaw) : NaN;
    if (!Number.isFinite(clientId) || clientId <= 0) {
      throw new UnauthorizedException('EXTERNAL_API_CLIENT_ID is not configured');
    }

    req.user = {
      id: 0,
      username: 'external-api',
      role: 'client',
      client_id: clientId,
    };
    return true;
  }
}

function extractBearerApiKey(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const m = /^ApiKey\s+(.+)$/i.exec(authorization.trim());
  return m?.[1]?.trim();
}

/** Constant-time string compare for API keys. */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still compare to avoid leaking length via timing of early return alone
    let diff = bufA.length ^ bufB.length;
    const len = Math.min(bufA.length, bufB.length);
    for (let i = 0; i < len; i++) diff |= bufA[i]! ^ bufB[i]!;
    return diff === 0 && bufA.length === bufB.length;
  }
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i]! ^ bufB[i]!;
  return diff === 0;
}
