import { ModuleName, PermissionAction, PermissionScope } from '../enums/index';

/**
 * Builds a type-safe "module:action:scope" permission string.
 */
export function perm(
  module: ModuleName,
  action: PermissionAction,
  scope: PermissionScope = PermissionScope.ALL,
): string {
  return `${module}:${action}:${scope}`;
}
