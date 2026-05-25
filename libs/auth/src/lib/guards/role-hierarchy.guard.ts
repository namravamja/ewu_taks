import { AppLoggerService, BuiltInRole, ROLE_HIERARCHY_KEY } from '@mediastar/core';
import type { IUserContext } from '@mediastar/shared';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { IRoleHierarchyTarget } from '../interfaces/role-hierarchy-target.interface';
import { UserService } from '../services/user.service';
import type { ICachedUserRole } from '../session/cached-user-role.interface';
import { UserRoleCacheService } from '../session/user-role-cache.service';

@Injectable()
export class RoleHierarchyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UserService,
    private readonly userRoleCache: UserRoleCacheService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(RoleHierarchyGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targetParam = this.reflector.get<string>(ROLE_HIERARCHY_KEY, context.getHandler());
    if (!targetParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actor = request.user as IUserContext | undefined;

    if (!actor) {
      throw new ForbiddenException('Authentication required for role hierarchy check');
    }

    if (actor.effectiveRoleLevel === 0) {
      this.logger.warn(
        `User ${actor.userId} denied: actor role level is 0 (unset). Failing closed.`,
      );
      throw new ForbiddenException('Your role does not have a defined hierarchy level');
    }

    const targetUserId = Number(request.params[targetParam]); // eslint-disable-line security/detect-object-injection
    if (Number.isNaN(targetUserId)) {
      throw new ForbiddenException(`Invalid target user ID in param "${targetParam}"`);
    }

    if (actor.userId === targetUserId) {
      return true;
    }

    // Cache-aside: check cache first, fall back to DB, populate cache on miss
    const targetRole = await this.resolveTargetRole(targetUserId);

    if (!targetRole) {
      return true;
    }

    if (targetRole.roleLevel >= actor.effectiveRoleLevel) {
      if (!this.isOwnerPeerAction(actor, targetRole.roleLevel)) {
        this.logger.debug(
          `User ${actor.userId} (level ${actor.effectiveRoleLevel}) denied action on user ${targetUserId} (level ${targetRole.roleLevel})`,
        );
        throw new ForbiddenException(
          'Cannot perform this action on users at the same or higher role level',
        );
      }
    }

    request.roleHierarchyTarget = {
      userId: targetUserId,
      roleIds: targetRole.roleIds,
      roleLevel: targetRole.roleLevel,
    } satisfies IRoleHierarchyTarget;

    return true;
  }

  /**
   * Owners are allowed to act on users at their own level (peer actions).
   * This enables owner-to-owner role management without opening the gate for other roles.
   *
   * Safety: Owner (level 100) is the highest built-in role. `effectiveRoleLevel` is
   * `Math.max(...)` of all assigned role levels, so for any user holding the Owner role
   * it will always be 100. A higher-level role would be a seed/data integrity issue,
   * and the strict equality check below ensures we only bypass at the exact peer level,
   * never above it.
   */
  private isOwnerPeerAction(actor: IUserContext, targetRoleLevel: number): boolean {
    const ownerLower = BuiltInRole.Owner.toLowerCase();
    const actorIsOwner = actor.roles.some((r) => r.name.toLowerCase() === ownerLower);
    if (!actorIsOwner) {
      return false;
    }
    return targetRoleLevel === actor.effectiveRoleLevel;
  }

  /**
   * Resolves the target user's role from cache, falling back to DB on miss.
   * Returns null when the user does not exist or has no assigned roles.
   */
  private async resolveTargetRole(userId: number): Promise<ICachedUserRole | null> {
    const cached = await this.userRoleCache.get(userId);
    if (cached) {
      return cached;
    }

    const targetUser = await this.userService.findRoleInfo(userId);
    if (!targetUser || targetUser.userRoles.length === 0) {
      return null;
    }

    const roleIds = targetUser.userRoles.map((ur) => ur.role.id);
    const roleLevel = Math.max(...targetUser.userRoles.map((ur) => ur.role.level));
    const roleData = { roleIds, roleLevel };

    // Fire-and-forget — cache write failure is non-fatal
    this.userRoleCache.set(userId, roleData);

    return roleData;
  }
}
