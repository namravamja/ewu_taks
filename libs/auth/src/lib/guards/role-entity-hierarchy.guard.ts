import { AppLoggerService, BuiltInRole, ROLE_ENTITY_HIERARCHY_KEY } from '@mediastar/core';
import { DatabaseService } from '@mediastar/database';
import type { IUserContext } from '@mediastar/shared';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { RoleEntityHierarchyOptions } from '../decorators/role-entity-hierarchy.decorator';

@Injectable()
export class RoleEntityHierarchyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(RoleEntityHierarchyGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.resolveOptions(context);
    if (!options) {
      return true;
    }

    const actor = this.getAuthenticatedActor(context);
    const roleIds = this.extractRoleIds(context.switchToHttp().getRequest(), options);
    if (roleIds.length === 0) {
      return true;
    }

    const roles = await this.db.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true, level: true },
    });

    const forbidden = roles.filter((r) => r.level >= actor.effectiveRoleLevel);
    if (forbidden.length === 0) {
      return true;
    }

    if (this.isOwnerPeerAction(actor, forbidden)) {
      return true;
    }

    const names = forbidden.map((r) => `${r.name} (level ${r.level})`).join(', ');
    this.logger.debug(
      `User ${actor.userId} (level ${actor.effectiveRoleLevel}) denied action on role(s): ${names}`,
    );
    throw new ForbiddenException('Cannot perform this action on roles at the same or higher level');
  }

  /**
   * Owners are allowed to assign/modify roles at their own level (peer actions).
   * This enables owner-to-owner invitation without opening the gate for other roles.
   */
  private isOwnerPeerAction(
    actor: IUserContext,
    forbiddenRoles: Array<{ level: number }>,
  ): boolean {
    const ownerLower = BuiltInRole.Owner.toLowerCase();
    const actorIsOwner = actor.roles.some((r) => r.name.toLowerCase() === ownerLower);
    if (!actorIsOwner) {
      return false;
    }
    return forbiddenRoles.every((r) => r.level === actor.effectiveRoleLevel);
  }

  private resolveOptions(context: ExecutionContext): RoleEntityHierarchyOptions | null {
    const meta = this.reflector.get<RoleEntityHierarchyOptions | string | undefined>(
      ROLE_ENTITY_HIERARCHY_KEY,
      context.getHandler(),
    );
    if (!meta) {
      return null;
    }
    return typeof meta === 'string' ? { source: 'param', field: meta } : meta;
  }

  private getAuthenticatedActor(context: ExecutionContext): IUserContext {
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

    return actor;
  }

  private extractRoleIds(
    request: { params: Record<string, string>; body?: Record<string, unknown> },
    options: RoleEntityHierarchyOptions,
  ): number[] {
    const field = options.field as string;

    if (options.source === 'body') {
      if (!request.body || !Object.hasOwn(request.body, field)) {
        return [];
      }
      const value = Reflect.get(request.body, field) as unknown;
      if (!Array.isArray(value) || value.length === 0) {
        return [];
      }
      return value.filter((id): id is number => typeof id === 'number');
    }

    if (!Object.hasOwn(request.params, field)) {
      return [];
    }
    const id = Number(Reflect.get(request.params, field));
    if (Number.isNaN(id)) {
      throw new ForbiddenException(`Invalid target role ID in param "${field}"`);
    }
    return [id];
  }
}
