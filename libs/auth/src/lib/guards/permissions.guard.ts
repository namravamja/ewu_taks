import { AppLoggerService, IS_PUBLIC_KEY, PERMISSIONS_KEY } from '@mediastar/core';
import type { IUserContext } from '@mediastar/shared';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { parsePermission } from '../rbac/parse-permission.util';
import { RbacService } from '../rbac/rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(PermissionsGuard.name);
  }

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

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!user.roles?.length) {
      throw new ForbiddenException('User has no assigned role');
    }

    const entries = await Promise.all(
      user.roles.map((role) => this.rbacService.getPermissionsForRole(role.id)),
    );

    for (const perm of requiredPermissions) {
      const { module, action } = parsePermission(perm);
      if (entries.some((entry) => entry.trie.has(`${module}:${action}`))) {
        return true;
      }
    }

    this.logger.debug(
      `User ${user.userId} denied: requires one of [${requiredPermissions.join(', ')}]`,
    );
    throw new ForbiddenException('Insufficient permissions');
  }
}
