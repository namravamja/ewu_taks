import { ModuleName, PermissionAction } from '@mediastar/core';
import { type IUserContext, TRASH_BULK_ACTIONS, type TrashBulkAction } from '@mediastar/shared';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { RbacService } from '../rbac/rbac.service';

const ACTION_TO_PERMISSION: ReadonlyMap<TrashBulkAction, PermissionAction> = new Map([
  ['restore', PermissionAction.Restore],
  ['hard_delete', PermissionAction.HardDelete],
]);

const TRASH_BULK_ACTION_SET: ReadonlySet<TrashBulkAction> = new Set(TRASH_BULK_ACTIONS);

/**
 * Guard for bulk-trash endpoints whose handler accepts both `trash:restore`
 * and `trash:hard_delete` permissions. Inspects the request body's `action`
 * and enforces that the acting user holds the matching permission.
 *
 * Pair with `@Permissions(perm(M.Trash, A.Restore), perm(M.Trash, A.HardDelete))`
 * so the global `PermissionsGuard` rejects users who hold neither (OR-check),
 * and use this guard to disambiguate which of the two is actually required.
 *
 * Scope semantics: this guard performs a presence-only check (matches
 * `PermissionsGuard`). It does NOT verify that the requested ids fall within
 * the actor's scope — that is the bulk-action service's responsibility, and
 * each service must filter `dto.ids` against the actor's scope (OWN /
 * ASSIGNED / TEAM / ALL) just like its non-trash mutations do. Granting a
 * role `trash:restore:OWN` is therefore only safe if the corresponding
 * service applies the same ownership filter on `dto.ids` before acting.
 *
 * Guards run before pipes, so `request.body` here is unvalidated. We tolerate
 * that by bailing out on anything other than the two known action strings —
 * `ValidationPipe` rejects malformed bodies after this guard returns.
 */
@Injectable()
export class TrashBulkActionGuard implements CanActivate {
  constructor(private readonly rbacService: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // user is guaranteed by the global JwtAuthGuard + PermissionsGuard that ran first.
    const user = request.user as IUserContext;

    const action = (request.body as { action?: TrashBulkAction } | undefined)?.action;
    if (!action || !TRASH_BULK_ACTION_SET.has(action)) {
      return true;
    }

    const requiredPermission = `${ModuleName.Trash}:${ACTION_TO_PERMISSION.get(action)}`;
    const roleIds = user.roles.map((r) => r.id);

    const checks = await Promise.all(
      roleIds.map((id) => this.rbacService.hasPermission(id, requiredPermission)),
    );

    if (!checks.some(Boolean)) {
      throw new ForbiddenException(`Insufficient permissions to ${action} trashed records`);
    }

    return true;
  }
}
