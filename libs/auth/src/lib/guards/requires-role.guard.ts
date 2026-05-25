import { REQUIRES_ROLE_KEY } from '@mediastar/core';
import type { IUserContext } from '@mediastar/shared';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

/**
 * Guard that enforces the acting user holds a specific role (by name).
 * Reads the required role name from the `REQUIRES_ROLE_KEY` metadata
 * set by `@RequiresRole()`.
 */
@Injectable()
export class RequiresRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<string | undefined>(REQUIRES_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRole) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as IUserContext | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const requiredLower = requiredRole.toLowerCase();
    const hasRole = user.roles.some((r) => r.name.toLowerCase() === requiredLower);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
