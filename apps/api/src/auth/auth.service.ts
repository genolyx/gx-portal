import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import type { UserProfile, TokenPayload } from '@gx-portal/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string): Promise<{ access_token: string; user: UserProfile }> {
    const user = await this.users.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      username: user.username,
      role: user.role,
      client_id: user.client_id,
      lab_id: user.lab_id,
    };

    const access_token = this.jwt.sign(payload);
    return { access_token, user };
  }

  verifyToken(token: string): TokenPayload {
    return this.jwt.verify<TokenPayload>(token);
  }
}
