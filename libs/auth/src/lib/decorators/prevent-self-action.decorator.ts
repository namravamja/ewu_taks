import { SELF_ACTION_KEY } from '@mediastar/core';
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { SelfActionGuard } from '../guards/self-action.guard';
import type { ISelfActionGuardOptions } from '../interfaces/self-action-guard-options.interface';

/**
 * Prevents the authenticated user from performing an action on themselves.
 *
 * Compares `request.user.userId` against the route param specified by `targetParam`.
 * If they match, a `ForbiddenException` is thrown with the given `message`.
 *
 * @param targetParam - Route parameter containing the target user ID (default: `'id'`)
 * @param message - Custom forbidden message for self-actions
 */
export function PreventSelfAction(targetParam = 'id', message?: string) {
  const options: ISelfActionGuardOptions = { targetParam, message };

  return applyDecorators(SetMetadata(SELF_ACTION_KEY, options), UseGuards(SelfActionGuard));
}
