import type { IScopeContext } from '@mediastar/core';
import {
  AppLoggerService,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  PermissionScope,
  setScopeContext,
} from '@mediastar/core';
import type { IUserContext } from '@mediastar/shared';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RBAC_SCOPE_HIERARCHY } from '../constants';
import { parsePermission } from '../rbac/parse-permission.util';
import { RbacService } from '../rbac/rbac.service';
import { TeamMembershipCacheService } from '../services/team-membership-cache.service';

function scopeLevel(scope: PermissionScope): number {
  return RBAC_SCOPE_HIERARCHY.get(scope) ?? 0;
}

/**
 * Global guard that resolves the user's effective permission scope and attaches
 * it to the request as `request.scopeContext`.
 *
 * This guard enriches the request — it never denies access. It must run after
 * `PermissionsGuard` (which validates the permission exists) and `JwtAuthGuard`
 * (which populates `request.user`).
 *
 * Registration order in `AppModule`: Throttle → JwtAuth → Permissions → ScopeResolution
 */
@Injectable()
export class ScopeResolutionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
    private readonly teamMembershipCache: TeamMembershipCacheService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(ScopeResolutionGuard.name);
  }

  // eslint-disable-next-line sonarjs/no-invariant-returns -- this guard enriches the request, never denies
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as IUserContext | undefined;
    if (!user?.roles?.length) {
      return true;
    }

    const roleIds = user.roles.map((r) => r.id);

    // Resolve the widest scope across all declared permissions (OR logic matches PermissionsGuard)
    let effectiveScope: PermissionScope | null = null;
    for (const perm of requiredPermissions) {
      const { module, action } = parsePermission(perm);
      const scope = await this.rbacService.getEffectiveScope(roleIds, module, action);
      if (scope === PermissionScope.ALL) {
        effectiveScope = scope;
        break;
      }
      if (scope && (!effectiveScope || scopeLevel(scope) > scopeLevel(effectiveScope))) {
        effectiveScope = scope;
      }
    }
    if (!effectiveScope) {
      return true;
    }

    let scopeContext: IScopeContext = { effectiveScope, userId: user.userId };

    // TEAM scope includes OWN + ASSIGNED + TEAM — we need team IDs for the TEAM part
    if (effectiveScope === PermissionScope.TEAM) {
      const teamIds = await this.teamMembershipCache.getTeamIds(user.userId);
      scopeContext = { effectiveScope, userId: user.userId, teamIds };
      this.logger.debug(`User ${user.userId} scope resolved: TEAM (${teamIds.length} team(s))`);
    }

    setScopeContext(scopeContext);

    return true;
  }
}
