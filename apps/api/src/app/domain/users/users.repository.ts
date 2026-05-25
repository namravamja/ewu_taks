import { AuditAction } from '@mediastar/core';
import {
  DatabaseService,
  INCLUDE_SOFT_DELETED,
  Prisma,
  type TxClient,
  UserStatus,
} from '@mediastar/database';
import { buildPaginationArgs, POPULATED_USER_SELECT } from '@mediastar/shared';
import { Injectable } from '@nestjs/common';

import type { TrashUsersQueryDTO } from './dtos';
import { UsersQueryDTO } from './dtos';

const USER_RESPONSE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  type: true,
  city: true,
  state: true,
  zip: true,
  status: true,
  lastLoginAt: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
  isCredentialEnabled: true,
  isTwoFactorEnabled: true,
  isTwoFactorEnforced: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    select: {
      role: { select: { id: true, name: true } },
    },
  },
  invitation: {
    select: {
      status: true,
      tokenExpiry: true,
      acceptedAt: true,
      createdAt: true,
      inviter: { select: POPULATED_USER_SELECT },
    },
  },
} satisfies Prisma.UserSelect;

export type UserWithRoles = Prisma.UserGetPayload<{ select: typeof USER_RESPONSE_SELECT }>;

const DELETED_USER_RESPONSE_SELECT = {
  ...USER_RESPONSE_SELECT,
  deletedAt: true,
  deletedByUser: { select: POPULATED_USER_SELECT },
} satisfies Prisma.UserSelect;

export type DeletedUserWithRoles = Prisma.UserGetPayload<{
  select: typeof DELETED_USER_RESPONSE_SELECT;
}>;

function buildNameSearch(search: string): Prisma.UserWhereInput[] {
  const terms = search.trim().split(/\s+/).filter(Boolean);
  return terms.map((term) => ({
    OR: [
      { firstName: { contains: term, mode: 'insensitive' as const } },
      { lastName: { contains: term, mode: 'insensitive' as const } },
    ],
  }));
}

const _USER_LITE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

export type UserLite = Prisma.UserGetPayload<{ select: typeof _USER_LITE_SELECT }>;

function buildUsersWhere(query: UsersQueryDTO): Prisma.UserWhereInput {
  const { search, roleId, status, createdAtFrom, createdAtTo, lastLoginAtFrom, lastLoginAtTo } =
    query;
  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { AND: buildNameSearch(search) },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (roleId && roleId.length > 0) {
    where.userRoles = { some: { roleId: { in: roleId } } };
  }

  if (status && status.length > 0) {
    where.status = { in: status };
  }

  if (createdAtFrom || createdAtTo) {
    where.createdAt = {
      ...(createdAtFrom && { gte: new Date(createdAtFrom) }),
      ...(createdAtTo && { lte: new Date(createdAtTo) }),
    };
  }

  if (lastLoginAtFrom || lastLoginAtTo) {
    where.lastLoginAt = {
      ...(lastLoginAtFrom && { gte: new Date(lastLoginAtFrom) }),
      ...(lastLoginAtTo && { lte: new Date(lastLoginAtTo) }),
    };
  }

  return where;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findFilterOptions(
    search: string | undefined,
    limit: number,
    cursorId?: number,
    includeInactive = false,
  ): Promise<{ value: number; label: string }[]> {
    const where: Prisma.UserWhereInput = includeInactive ? {} : { status: UserStatus.ACTIVE };
    if (search) {
      where.AND = buildNameSearch(search);
    }
    const users = await this.db.user.findMany({
      where,
      select: POPULATED_USER_SELECT,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: limit + 1,
      ...(cursorId != null && { skip: 1, cursor: { id: cursorId } }),
    });
    return users.map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') || `User ${u.id}`,
    }));
  }

  async findById(id: number): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { id },
      select: USER_RESPONSE_SELECT,
    });
  }

  async findUserDisplayInfo(
    id: number,
  ): Promise<{ firstName: string | null; lastName: string | null; email: string } | null> {
    return this.db.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, email: true },
    });
  }

  async findMany(query: UsersQueryDTO): Promise<[UserWithRoles[], number]> {
    const { skip, take } = buildPaginationArgs(query);
    const { sortBy, sort: sortOrder = 'desc' } = query;

    const where = buildUsersWhere(query);

    const orderBy: Prisma.UserOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    const [data, total] = await Promise.all([
      this.db.user.findMany({
        where,
        select: USER_RESPONSE_SELECT,
        skip,
        take,
        orderBy,
      }),
      this.db.user.count({ where }),
    ]);

    return [data, total];
  }

  async update(id: number, data: Prisma.UserUpdateInput): Promise<UserWithRoles> {
    return this.db.user.update({
      where: { id },
      data,
      select: USER_RESPONSE_SELECT,
    });
  }

  async updatePassword(userId: number, passwordHash: string, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        loginAttempts: 0,
        loginAttemptsLockout: null,
        resetToken: null,
      },
    });
  }

  async findByIdForProviderSwitch(id: number): Promise<{
    id: number;
    email: string;
    status: string;
    firstName: string | null;
    lastName: string | null;
    passwordHash: string | null;
    isCredentialEnabled: boolean;
  } | null> {
    return this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        isCredentialEnabled: true,
      },
    });
  }

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { email },
      select: USER_RESPONSE_SELECT,
    });
  }

  async updateEmail(userId: number, newEmail: string, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId },
      data: { email: newEmail },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.db.user.count({ where: { email } });
    return count > 0;
  }

  async createInvitedUser(
    data: {
      email: string;
      firstName: string | null;
      lastName: string | null;
      roleIds: number[];
      assignedBy: number;
      isCredentialEnabled?: boolean;
      isTwoFactorEnforced?: boolean;
      twoFactorGracePeriodEnd?: Date;
    },
    tx?: TxClient,
  ): Promise<{ id: number }> {
    const client = tx ?? this.db;
    return client.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: null,
        status: UserStatus.INVITED,
        ...(data.isCredentialEnabled !== undefined && {
          isCredentialEnabled: data.isCredentialEnabled,
        }),
        ...(data.isTwoFactorEnforced !== undefined && {
          isTwoFactorEnforced: data.isTwoFactorEnforced,
          twoFactorGracePeriodEnd: data.twoFactorGracePeriodEnd,
        }),
        userRoles: {
          create: data.roleIds.map((roleId) => ({ roleId, assignedBy: data.assignedBy })),
        },
      },
      select: { id: true },
    });
  }

  async activateUser(userId: number, passwordHash: string, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId, status: UserStatus.INVITED },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async approveUser(
    id: number,
    reviewerId: number,
    data: ActivateWithRoleData,
  ): Promise<UserWithRoles> {
    return this.activateWithRole(id, reviewerId, UserStatus.PENDING, data);
  }

  async rejectUser(id: number, reviewerId: number, reason: string | null): Promise<UserWithRoles> {
    return this.db.user.update({
      where: { id, status: UserStatus.PENDING },
      data: {
        status: UserStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      select: USER_RESPONSE_SELECT,
    });
  }

  async unrejectToPending(id: number, reviewerId: number): Promise<UserWithRoles> {
    return this.db.user.update({
      where: { id, status: UserStatus.REJECTED },
      data: {
        status: UserStatus.PENDING,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      select: USER_RESPONSE_SELECT,
    });
  }

  async unrejectToActive(
    id: number,
    reviewerId: number,
    data: ActivateWithRoleData,
  ): Promise<UserWithRoles> {
    return this.activateWithRole(id, reviewerId, UserStatus.REJECTED, data, {
      rejectionReason: null,
    });
  }

  async unsuspendUser(
    id: number,
    reviewerId: number,
    data: {
      isCredentialEnabled: boolean;
      setPasswordToken?: string;
      setPasswordRequestedAt?: Date;
    },
  ): Promise<UserWithRoles> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.user.findFirstOrThrow({
        where: { id, status: UserStatus.SUSPENDED } as never,
        select: { passwordHash: true },
      });

      return tx.user.update({
        where: { id, status: UserStatus.SUSPENDED },
        data: {
          status: UserStatus.ACTIVE,
          suspendedAt: null,
          suspendedBy: null,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          isCredentialEnabled: data.isCredentialEnabled,
          passwordHash: null,
          previousPasswordHash: current.passwordHash,
          ...(data.setPasswordToken && {
            setPasswordToken: data.setPasswordToken,
            setPasswordRequestedAt: data.setPasswordRequestedAt,
          }),
        },
        select: USER_RESPONSE_SELECT,
      });
    }) as unknown as Promise<UserWithRoles>;
  }

  async reactivateUser(
    id: number,
    reviewerId: number,
    data: {
      isCredentialEnabled: boolean;
      roleIds?: number[];
      setPasswordToken?: string;
      setPasswordRequestedAt?: Date;
    },
  ): Promise<UserWithRoles> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.user.findFirstOrThrow({
        where: { id, status: UserStatus.INACTIVE } as never,
        select: { passwordHash: true },
      });

      await tx.user.update({
        where: { id, status: UserStatus.INACTIVE },
        data: {
          status: UserStatus.ACTIVE,
          deactivatedAt: null,
          deactivatedBy: null,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          isCredentialEnabled: data.isCredentialEnabled,
          passwordHash: null,
          previousPasswordHash: current.passwordHash,
          ...(data.setPasswordToken && {
            setPasswordToken: data.setPasswordToken,
            setPasswordRequestedAt: data.setPasswordRequestedAt,
          }),
        },
      });

      if (data.roleIds?.length) {
        await this.syncUserRoles(tx as never, id, data.roleIds, reviewerId);
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: USER_RESPONSE_SELECT,
      });
    }) as unknown as Promise<UserWithRoles>;
  }

  async deactivateUserInTx(
    tx: TxClient,
    id: number,
    data: Prisma.UserUncheckedUpdateInput,
  ): Promise<UserWithRoles> {
    return tx.user.update({
      where: { id, status: { in: [UserStatus.ACTIVE, UserStatus.SUSPENDED] } },
      data,
      select: USER_RESPONSE_SELECT,
    }) as unknown as Promise<UserWithRoles>;
  }

  async suspendUserInTx(
    tx: TxClient,
    id: number,
    data: Prisma.UserUpdateInput,
  ): Promise<UserWithRoles> {
    return tx.user.update({
      where: { id, status: UserStatus.ACTIVE },
      data,
      select: USER_RESPONSE_SELECT,
    }) as unknown as Promise<UserWithRoles>;
  }

  async enforceTwoFactor(where: Prisma.UserWhereInput, gracePeriodEnd: Date): Promise<number> {
    const [alreadyEnabled, notEnabled] = await this.db.$transaction([
      this.db.user.updateMany({
        where: {
          ...where,
          isCredentialEnabled: true,
          isTwoFactorEnforced: false,
          isTwoFactorEnabled: true,
        },
        data: { isTwoFactorEnforced: true },
      }),
      this.db.user.updateMany({
        where: {
          ...where,
          isCredentialEnabled: true,
          isTwoFactorEnforced: false,
          isTwoFactorEnabled: false,
        },
        data: { isTwoFactorEnforced: true, twoFactorGracePeriodEnd: gracePeriodEnd },
      }),
    ]);
    return alreadyEnabled.count + notEnabled.count;
  }

  async removeTwoFactorEnforcement(where: Prisma.UserWhereInput): Promise<number> {
    const result = await this.db.user.updateMany({
      where: { ...where, isTwoFactorEnforced: true },
      data: { isTwoFactorEnforced: false, twoFactorGracePeriodEnd: null },
    });
    return result.count;
  }

  async findMaxRoleLevelByUserIds(userIds: number[]): Promise<number | null> {
    const topRole = await this.db.userRole.findFirst({
      where: { userId: { in: userIds }, user: { isDeleted: false } },
      select: { role: { select: { level: true } } },
      orderBy: { role: { level: 'desc' } },
    });

    return topRole?.role.level ?? null;
  }

  async countRecentProviderSwitches(targetUserId: number, windowStart: Date): Promise<number> {
    return this.db.auditLog.count({
      where: {
        action: AuditAction.ProviderSwitch,
        targetUserId,
        createdAt: { gt: windowStart },
      },
    });
  }

  async updateAuthProviderInTx(
    tx: TxClient,
    userId: number,
    data: Prisma.UserUpdateInput,
  ): Promise<void> {
    await tx.user.update({ where: { id: userId }, data });
  }

  async deleteCredentialArtifacts(tx: TxClient, userId: number): Promise<void> {
    await tx.backupCode.deleteMany({ where: { userId } });
    await tx.trustedDevice.deleteMany({ where: { userId } });
  }

  async setStatus(
    userId: number,
    status: UserStatus,
    requiredStatus: UserStatus | UserStatus[],
    tx?: TxClient,
  ): Promise<boolean> {
    const client = tx ?? this.db;
    const requiredFilter = Array.isArray(requiredStatus) ? { in: requiredStatus } : requiredStatus;
    const result = await client.user.updateMany({
      where: { id: userId, status: requiredFilter },
      data: { status },
    });
    return result.count === 1;
  }

  async hasInvitation(userId: number): Promise<boolean> {
    const record = await this.db.userInvitation.findUnique({
      where: { userId },
      select: { id: true },
    });
    return record !== null;
  }

  async findDeletedUsers(query: TrashUsersQueryDTO): Promise<[DeletedUserWithRoles[], number]> {
    const { skip, take } = buildPaginationArgs(query);
    const {
      search,
      roleId,
      status,
      deletedAtFrom,
      deletedAtTo,
      sortBy,
      sort: sortOrder = 'desc',
    } = query;

    const where: Prisma.UserWhereInput = { isDeleted: true };

    if (status && status.length > 0) {
      where.status = { in: status };
    }

    if (search) {
      where.OR = [
        { AND: buildNameSearch(search) },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roleId && roleId.length > 0) {
      where.userRoles = { some: { roleId: { in: roleId } } };
    }

    if (deletedAtFrom || deletedAtTo) {
      where.deletedAt = {
        ...(deletedAtFrom && { gte: new Date(deletedAtFrom) }),
        ...(deletedAtTo && { lte: new Date(deletedAtTo) }),
      };
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { deletedAt: sortOrder };

    const [data, total] = await Promise.all([
      this.db.user.findMany({
        where,
        select: DELETED_USER_RESPONSE_SELECT,
        skip,
        take,
        orderBy,
      }),
      this.db.user.count({ where }),
    ]);

    return [data as DeletedUserWithRoles[], total];
  }

  async findDeletedById(id: number): Promise<DeletedUserWithRoles | null> {
    return this.db.user.findFirst({
      where: { id, isDeleted: true },
      select: DELETED_USER_RESPONSE_SELECT,
    }) as Promise<DeletedUserWithRoles | null>;
  }

  async findByIdIncludingDeleted(id: number): Promise<{ id: number; isDeleted: boolean } | null> {
    return this.db.user.findFirst({
      where: { id, isDeleted: INCLUDE_SOFT_DELETED as never },
      select: { id: true, isDeleted: true },
    });
  }

  async restoreUser(id: number, reviewerId: number): Promise<UserWithRoles> {
    const result = await this.db.user.updateMany({
      where: { id, isDeleted: true } as never,
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
        deactivatedBy: null,
        suspendedAt: null,
        suspendedBy: null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new Error(`Deleted user with id ${id} not found`);
    }

    return this.db.user.findUniqueOrThrow({
      where: { id },
      select: USER_RESPONSE_SELECT,
    }) as unknown as Promise<UserWithRoles>;
  }

  async softDelete(id: number, deletedBy: number): Promise<void> {
    await this.db.user.delete({ where: { id }, deletedBy });
  }

  async findDeletedByIds(ids: number[]): Promise<{ id: number }[]> {
    return this.db.user.findMany({
      where: { id: { in: ids }, isDeleted: true },
      select: { id: true },
    });
  }

  async bulkRestore(ids: number[], reviewerId: number): Promise<void> {
    await this.db.user.updateMany({
      where: { id: { in: ids }, isDeleted: true } as never,
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
        deactivatedBy: null,
        suspendedAt: null,
        suspendedBy: null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  private async activateWithRole(
    id: number,
    reviewerId: number,
    requiredStatus: UserStatus,
    data: ActivateWithRoleData,
    extraData?: Prisma.UserUncheckedUpdateInput,
  ): Promise<UserWithRoles> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.user.findFirstOrThrow({
        where: { id, status: requiredStatus } as never,
        select: { passwordHash: true },
      });

      await tx.user.update({
        where: { id, status: requiredStatus },
        data: {
          status: UserStatus.ACTIVE,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          isCredentialEnabled: data.isCredentialEnabled,
          setPasswordToken: data.setPasswordToken,
          setPasswordRequestedAt: data.setPasswordRequestedAt,
          passwordHash: null,
          previousPasswordHash: current.passwordHash,
          ...extraData,
        },
      });

      await this.syncUserRoles(tx as never, id, data.roleIds, reviewerId);

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: USER_RESPONSE_SELECT,
      });
    }) as unknown as Promise<UserWithRoles>;
  }

  async syncUserRoles(
    tx: TxClient,
    userId: number,
    roleIds: number[],
    assignedBy: number,
  ): Promise<void> {
    const currentLinks = await tx.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const currentIds = new Set(currentLinks.map((l) => l.roleId));
    const targetIds = new Set(roleIds);

    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
    const toAdd = roleIds.filter((id) => !currentIds.has(id));

    if (toRemove.length > 0) {
      await tx.userRole.deleteMany({ where: { userId, roleId: { in: toRemove } } });
    }

    if (toAdd.length > 0) {
      await tx.userRole.createMany({
        data: toAdd.map((roleId) => ({ userId, roleId, assignedBy })),
        skipDuplicates: true,
      });
    }
  }
}

interface ActivateWithRoleData {
  roleIds: number[];
  isCredentialEnabled: boolean;
  setPasswordToken?: string;
  setPasswordRequestedAt?: Date;
}
