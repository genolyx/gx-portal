import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Phase 1: allows unauthenticated access (passes through if no token).
 * Phase 3: swap all controllers to JwtAuthGuard for hard enforcement.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(_err: unknown, user: T): T {
    return user;
  }
}
