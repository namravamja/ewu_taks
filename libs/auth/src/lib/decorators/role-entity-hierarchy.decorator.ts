import { ROLE_ENTITY_HIERARCHY_KEY } from '@mediastar/core';
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { RoleEntityHierarchyGuard } from '../guards/role-entity-hierarchy.guard';

export interface RoleEntityHierarchyOptions {
  /** Where to read role IDs from: `'param'` (single ID) or `'body'` (array). Default: `'param'` */
  source: 'param' | 'body';
  /** The param name or body field name. Default: `'id'` for param, `'roleIds'` for body */
  field?: string;
}

/**
 * Enforces that the acting user's role level is strictly higher than the
 * target role entity's level.
 *
 * **Param mode** (default): reads a single role ID from `req.params[field]`.
 * **Body mode**: reads an array of role IDs from `req.body[field]`.
 *
 * Must be placed after `@Permissions()` so that the global guards (JwtAuth → Permissions)
 * run first — `request.user` is guaranteed to be populated when this guard executes.
 *
 * @example
 * // Param mode (existing behavior)
 * @EnforceRoleEntityHierarchy()           // reads req.params['id']
 * @EnforceRoleEntityHierarchy('roleId')   // reads req.params['roleId']
 *
 * @example
 * // Body mode (for roleIds arrays)
 * @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
 */
export function EnforceRoleEntityHierarchy(options?: string | RoleEntityHierarchyOptions) {
  let resolved: RoleEntityHierarchyOptions;
  if (options == null) {
    resolved = { source: 'param', field: 'id' };
  } else if (typeof options === 'string') {
    resolved = { source: 'param', field: options };
  } else {
    const defaultField = options.source === 'body' ? 'roleIds' : 'id';
    resolved = { source: options.source, field: options.field ?? defaultField };
  }

  return applyDecorators(
    SetMetadata(ROLE_ENTITY_HIERARCHY_KEY, resolved),
    UseGuards(RoleEntityHierarchyGuard),
  );
}
