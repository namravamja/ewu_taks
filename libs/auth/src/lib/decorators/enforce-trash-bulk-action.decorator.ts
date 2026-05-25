import { applyDecorators, UseGuards } from '@nestjs/common';

import { TrashBulkActionGuard } from '../guards/trash-bulk-action.guard';

/**
 * Enforces that the acting user holds the `trash:<action>` permission matching
 * the request body's `action` field (`restore` or `hard_delete`).
 *
 * Pair with `@Permissions(perm(M.Trash, A.Restore), perm(M.Trash, A.HardDelete))`
 * so the global `PermissionsGuard` first rejects users who hold neither permission;
 * this decorator then disambiguates which of the two is actually required.
 *
 * Must be placed after `@Permissions()` so the global guards (JwtAuth → Permissions)
 * run first — `request.user` is guaranteed to be populated when this guard executes.
 */
export function EnforceTrashBulkAction() {
  return applyDecorators(UseGuards(TrashBulkActionGuard));
}
