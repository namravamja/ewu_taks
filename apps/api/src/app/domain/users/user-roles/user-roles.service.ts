import { AppLoggerService } from '@mediastar/core';
import { PrismaClientKnownRequestError } from '@mediastar/database';
import type { IUserContext } from '@mediastar/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { UserRoleVM } from './dtos';
import { UserRolesRepository } from './user-roles.repository';

@Injectable()
export class UserRolesService {
  constructor(
    private readonly userRolesRepository: UserRolesRepository,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(UserRolesService.name);
  }

  async listRoles(userId: number): Promise<UserRoleVM[]> {
    const user = await this.userRolesRepository.findUserRoles(userId);

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    return user.userRoles.map((ur) => ({ ...ur.role, createdAt: ur.createdAt }));
  }

  async syncRoles(
    userId: number,
    roleIds: number[],
    assigner: IUserContext,
  ): Promise<UserRoleVM[]> {
    const [targetUser, roles] = await Promise.all([
      this.userRolesRepository.findUserWithRoleIds(userId),
      this.userRolesRepository.findRolesByIds(roleIds),
    ]);

    if (!targetUser) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const foundIds = new Set(roles.map((r) => r.id));
    const missing = roleIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Roles not found: ${missing.join(', ')}`);
    }

    const currentIds = new Set(targetUser.userRoles.map((ur) => ur.role.id));
    const targetIds = new Set(roleIds);

    const toAdd = roleIds.filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      return this.listRoles(userId);
    }

    try {
      await this.userRolesRepository.syncRoles(userId, toAdd, toRemove, assigner.userId);
    } catch (err: unknown) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Role sync failed due to a concurrent update — please retry');
      }
      throw err;
    }

    return this.listRoles(userId);
  }
}
