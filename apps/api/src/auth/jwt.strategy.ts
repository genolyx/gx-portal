import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { TokenPayload } from '@gx-portal/types';

function cookieOrBearerExtractor(req: Request): string | null {
  const fromCookie = req?.cookies?.['access_token'];
  if (fromCookie) return fromCookie as string;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
      passReqToCallback: false,
    });
  }

  validate(payload: TokenPayload) {
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      client_id: payload.client_id,
      lab_id: payload.lab_id,
    };
  }
}
