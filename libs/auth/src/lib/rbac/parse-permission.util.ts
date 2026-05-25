import { PermissionScope } from '@mediastar/core';

export interface ParsedPermission {
  module: string;
  action: string;
  scope: PermissionScope | null;
}

/**
 * Parses "module:action:scope" → { module, action, scope }.
 * Scope is `null` when omitted — the caller decides whether to enforce a minimum scope.
 */
export function parsePermission(perm: string): ParsedPermission {
  const parts = perm.split(':');
  if (!parts[0] || !parts[1]) {
    throw new Error(`Invalid permission format: "${perm}"`);
  }
  return {
    module: parts[0],
    action: parts[1],
    scope: (parts[2] as PermissionScope) ?? null,
  };
}
