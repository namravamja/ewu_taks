import {
  AppLoggerService,
  PERMISSIONS_KEY,
  PermissionScope,
  SCOPE_GUARD_KEY,
} from '@mediastar/core';
import type { IUserContext } from '@mediastar/shared';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { IScopeGuardOptions } from '../interfaces/scope-guard-options.interface';
import { parsePermission } from '../rbac/parse-permission.util';
import { RbacService } from '../rbac/rbac.service';

/**
 * Enforces scope-based ownership rules for routes decorated with `@Permissions(..., S.Own)`.
 *
 * - Self-actions (actor ID === target ID) are always allowed.
 * - Non-self actions require `all` scope for the same module:action.
 *
 * Must be placed after `@Permissions()` so that the global guards run first.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(ScopeGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<IScopeGuardOptions>(SCOPE_GUARD_KEY, context.getHandler());
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as IUserContext | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required for scope check');
    }

    const targetId = Number(request.params[options.targetParam]);
    if (Number.isNaN(targetId)) {
      throw new ForbiddenException(`Invalid target ID in param "${options.targetParam}"`);
    }

    if (user.userId === targetId) {
      return true;
    }

    // Non-self action: require `all` scope for the first `own`-scoped permission
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Check escalation for ALL own-scoped permissions, not just the first
    const ownPerms = requiredPermissions
      .map(parsePermission)
      .filter((p) => p.scope === PermissionScope.OWN);

    if (ownPerms.length === 0) {
      return true;
    }

    const roleIds = user.roles.map((r) => r.id);

    const results = await Promise.all(
      ownPerms.map(async (perm) => ({
        perm,
        hasAllScope: await this.rbacService.checkPermissionWithScopeForRoles(
          roleIds,
          perm.module,
          perm.action,
          PermissionScope.ALL,
        ),
      })),
    );

    const denied = results.find((r) => !r.hasAllScope);
    if (denied) {
      this.logger.debug(
        `User ${user.userId} denied: requires ${denied.perm.module}:${denied.perm.action}:all for non-self action`,
      );
      throw new ForbiddenException(
        options.message ?? 'You can only perform this action on your own resource',
      );
    }

    return true;
  }
}
