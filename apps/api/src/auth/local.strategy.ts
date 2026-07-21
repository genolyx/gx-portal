import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({ usernameField: 'username' });
  }

  async validate(username: string, password: string) {
    const user = await this.users.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
