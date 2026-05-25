import { ROLE_HIERARCHY_KEY } from '@mediastar/core';
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { RoleHierarchyGuard } from '../guards/role-hierarchy.guard';

/**
 * Enforces that the acting user's role level is strictly higher than the
 * target user's role level. Extracts the target user ID from `req.params[targetParam]`.
 *
 * Must be placed after `@Permissions()` so that the global guards (JwtAuth → Permissions)
 * run first — `request.user` is guaranteed to be populated when this guard executes.
 *
 * @param targetParam - Route parameter name containing the target user ID (default: `'id'`)
 */
export function EnforceRoleHierarchy(targetParam = 'id') {
  return applyDecorators(
    SetMetadata(ROLE_HIERARCHY_KEY, targetParam),
    UseGuards(RoleHierarchyGuard),
  );
}
