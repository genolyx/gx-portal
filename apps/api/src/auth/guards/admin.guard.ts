import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuth = await super.canActivate(context);
    if (!isAuth) return false;
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    return true;
  }
}
