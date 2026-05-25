import { SELF_ACTION_KEY } from '@mediastar/core';
import type { IUserContext } from '@mediastar/shared';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { ISelfActionGuardOptions } from '../interfaces/self-action-guard-options.interface';

/**
 * Prevents a user from performing an action on themselves.
 *
 * Reads `SELF_ACTION_KEY` metadata set by `@PreventSelfAction()` to determine
 * which route param holds the target user ID. If the authenticated user's ID
 * matches the target, a `ForbiddenException` is thrown.
 */
@Injectable()
export class SelfActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<ISelfActionGuardOptions>(
      SELF_ACTION_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as IUserContext | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const targetId = Number(request.params[options.targetParam]);
    if (Number.isNaN(targetId)) {
      throw new ForbiddenException(`Invalid target ID in param "${options.targetParam}"`);
    }

    if (user.userId === targetId) {
      throw new ForbiddenException(options.message ?? 'You cannot perform this action on yourself');
    }

    return true;
  }
}
