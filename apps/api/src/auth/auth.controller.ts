import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { LoginRequest } from '@gx-portal/types';

const ACCESS_TOKEN_COOKIE = 'access_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT in httpOnly cookie' })
  async login(
    @Body() body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, user } = await this.authService.login(
      body.username,
      body.password,
    );

    // COOKIE_SECURE=true only when serving over HTTPS. Docker :8090 is HTTP by default.
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const maxAgeMs = this.parseDurationMs(
      this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
      15 * 60 * 1000,
    );
    res.cookie(ACCESS_TOKEN_COOKIE, access_token, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'strict' : 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear auth cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    res.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'strict' : 'lax',
      path: '/',
    });
  }

  private parseDurationMs(value: string, fallback: number): number {
    const m = /^(\d+)([smhd])$/i.exec(value.trim());
    if (!m) return fallback;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const mult =
      unit === 's' ? 1000 :
      unit === 'm' ? 60_000 :
      unit === 'h' ? 3_600_000 :
      86_400_000;
    return n * mult;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user from token' })
  me(@Req() req: Request & { user: unknown }) {
    return req.user;
  }
}
