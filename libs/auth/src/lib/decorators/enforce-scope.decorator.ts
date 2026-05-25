import { SCOPE_GUARD_KEY } from '@mediastar/core';
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { ScopeGuard } from '../guards/scope.guard';
import type { IScopeGuardOptions } from '../interfaces/scope-guard-options.interface';

/**
 * Enforces scope-based ownership for `@Permissions(..., S.Own)` routes.
 *
 * - Self-actions are allowed automatically.
 * - Non-self actions require `all` scope for the same module:action.
 *
 * Must be placed after `@Permissions()` so that global guards (JwtAuth → Permissions) run first.
 *
 * @param targetParam - Route parameter containing the target user ID (default: `'id'`)
 * @param message - Custom forbidden message for non-self actions without `all` scope
 */
export function EnforceScope(targetParam = 'id', message?: string) {
  const options: IScopeGuardOptions = { targetParam, message };

  return applyDecorators(SetMetadata(SCOPE_GUARD_KEY, options), UseGuards(ScopeGuard));
}
