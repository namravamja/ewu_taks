import { DatabaseService, type TxClient } from '@mediastar/database';
import { Injectable } from '@nestjs/common';

interface UserRolesResult {
  userRoles: Array<{
    createdAt: Date;
    role: { id: number; name: string; level: number };
  }>;
}

interface UserWithRoleIds {
  id: number;
  userRoles: Array<{ role: { id: number; level: number } }>;
}

interface RoleResult {
  id: number;
  name: string;
  level: number;
}

@Injectable()
export class UserRolesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findUserRoles(userId: number): Promise<UserRolesResult | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: {
          select: {
            createdAt: true,
            role: { select: { id: true, name: true, level: true } },
          },
        },
      },
    });
  }

  async findUserWithRoleIds(userId: number): Promise<UserWithRoleIds | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userRoles: { select: { role: { select: { id: true, level: true } } } },
      },
    });
  }

  async findRolesByIds(roleIds: number[]): Promise<RoleResult[]> {
    return this.db.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true, level: true },
    });
  }

  async syncRoles(
    userId: number,
    toAdd: number[],
    toRemove: number[],
    assignedBy: number,
  ): Promise<void> {
    await this.db.$transaction(async (tx: TxClient) => {
      if (toRemove.length > 0) {
        await tx.userRole.deleteMany({
          where: { userId, roleId: { in: toRemove } },
        });
      }

      if (toAdd.length > 0) {
        await tx.userRole.createMany({
          data: toAdd.map((roleId) => ({ userId, roleId, assignedBy })),
          skipDuplicates: true,
        });
      }
    });
  }
}
