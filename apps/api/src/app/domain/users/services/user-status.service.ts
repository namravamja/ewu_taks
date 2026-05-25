import {
  PROVIDER_SWITCH_RATE_LIMIT,
  PROVIDER_SWITCH_WINDOW_MS,
  SessionCacheService,
  SessionRepository,
  TokenService,
} from '@mediastar/auth';
import { AppLoggerService } from '@mediastar/core';
import {
  DatabaseService,
  type Prisma,
  PrismaClientKnownRequestError,
  UserStatus,
} from '@mediastar/database';
import { fireAndForget } from '@mediastar/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RolesService } from '../../roles/roles.service';
import type {
  ApproveUserDTO,
  ReactivateUserDTO,
  UnrejectUserDTO,
  UpdateAuthProviderDTO,
  UserResponseVM,
} from '../dtos';
import { UsersRepository, type UserWithRoles } from '../users.repository';

const CONCURRENT_STATUS_CHANGE_MSG = 'User status changed concurrently. Please retry.';

@Injectable()
export class UserStatusService {
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly logger: AppLoggerService,
    private readonly db: DatabaseService,
    private readonly sessionRepo: SessionRepository,
    private readonly sessionCache: SessionCacheService,
    private readonly tokenService: TokenService,
    private readonly rolesService: RolesService,
  ) {
    this.logger.setContext(UserStatusService.name);
  }

  async approveUser(
    targetUserId: number,
    adminId: number,
    dto: ApproveUserDTO,
    actorRoleLevel: number,
    canAssignPeerLevel: boolean,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    await this.getPendingUserOrFail(targetUserId, 'approve', 'approved');

    const roleIds = this.resolveRoleIds(dto.roleIds);
    if (!dto.roleIds || dto.roleIds.length === 0) {
      await this.validateRoleHierarchy(roleIds, actorRoleLevel, canAssignPeerLevel);
    }
    await this.validateRoleIds(roleIds);

    const isCredentialEnabled = this.resolveCredentialFlag(dto.isCredentialEnabled);

    const tokenData = isCredentialEnabled ? this.generateSetPasswordToken() : undefined;

    const updated = await this.withConcurrencyGuard(() =>
      this.userRepository.approveUser(targetUserId, adminId, {
        roleIds,
        isCredentialEnabled,
        setPasswordToken: tokenData?.hashedToken,
        setPasswordRequestedAt: tokenData?.requestedAt,
      }),
    );

    this.logger.info('User registration approved', { userId: targetUserId, approvedBy: adminId });

    // Future: notify user via email/notification (email + notification subsystems removed)

    return toResponseVM(updated);
  }

  async rejectUser(
    targetUserId: number,
    adminId: number,
    reason: string | undefined,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    await this.getPendingUserOrFail(targetUserId, 'reject', 'rejected');

    const updated = await this.withConcurrencyGuard(() =>
      this.userRepository.rejectUser(targetUserId, adminId, reason ?? null),
    );

    this.logger.info('User registration rejected', {
      userId: targetUserId,
      rejectedBy: adminId,
      reason: reason ?? null,
    });

    return toResponseVM(updated);
  }

  async unrejectUser(
    targetUserId: number,
    adminId: number,
    dto: UnrejectUserDTO,
    actorRoleLevel: number,
    canAssignPeerLevel: boolean,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    await this.getRejectedUserOrFail(targetUserId);

    if (!dto.reactivate) {
      const updated = await this.withConcurrencyGuard(() =>
        this.userRepository.unrejectToPending(targetUserId, adminId),
      );
      this.logger.info('User un-rejected to PENDING', {
        userId: targetUserId,
        unrejectBy: adminId,
      });
      return toResponseVM(updated);
    }

    const roleIds = this.resolveRoleIds(dto.roleIds);
    if (!dto.roleIds || dto.roleIds.length === 0) {
      await this.validateRoleHierarchy(roleIds, actorRoleLevel, canAssignPeerLevel);
    }
    await this.validateRoleIds(roleIds);

    const isCredentialEnabled = this.resolveCredentialFlag(dto.isCredentialEnabled);

    const tokenData = isCredentialEnabled ? this.generateSetPasswordToken() : undefined;

    const updated = await this.withConcurrencyGuard(() =>
      this.userRepository.unrejectToActive(targetUserId, adminId, {
        roleIds,
        isCredentialEnabled,
        setPasswordToken: tokenData?.hashedToken,
        setPasswordRequestedAt: tokenData?.requestedAt,
      }),
    );

    this.logger.info('User un-rejected to ACTIVE', {
      userId: targetUserId,
      unrejectBy: adminId,
    });

    // Future: send approval email (email subsystem removed)

    return toResponseVM(updated);
  }

  async suspendUser(
    targetUserId: number,
    adminId: number,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    const user = await this.userRepository.findByIdForProviderSwitch(targetUserId);
    if (!user) {
      throw new NotFoundException(`User with id ${targetUserId} not found`);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot suspend a user with status "${user.status}". Only ACTIVE users can be suspended.`,
      );
    }

    const updated = await this.withConcurrencyGuard(() =>
      this.db.$transaction(async (tx) => {
        const updateData: Prisma.UserUpdateInput = {
          status: UserStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspendedByUser: { connect: { id: adminId } },
          isCredentialEnabled: false,
          resetToken: null,
          passwordResetRequestedAt: null,
        };

        const data = user.isCredentialEnabled
          ? { ...updateData, ...this.buildCredentialCleanupData() }
          : updateData;

        if (user.isCredentialEnabled) {
          await this.userRepository.deleteCredentialArtifacts(tx, targetUserId);
        }

        const result = await this.userRepository.suspendUserInTx(tx, targetUserId, data);
        await this.sessionRepo.deleteAllByUserId(targetUserId, tx);
        return result;
      }),
    );

    fireAndForget(
      this.sessionCache.invalidateAllUserSessions(targetUserId),
      this.logger,
      `invalidate sessions for user ${targetUserId}`,
    );

    this.logger.info('User suspended by admin', { userId: targetUserId, suspendedBy: adminId });

    return toResponseVM(updated);
  }

  async unsuspendUser(
    targetUserId: number,
    adminId: number,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException(`User with id ${targetUserId} not found`);
    }
    if (user.status !== UserStatus.SUSPENDED) {
      throw new BadRequestException(
        `Cannot unsuspend a user with status "${user.status}". Only SUSPENDED users can be unsuspended.`,
      );
    }

    const isCredentialEnabled = true;

    const tokenData = this.generateSetPasswordToken();

    const updated = await this.withConcurrencyGuard(() =>
      this.userRepository.unsuspendUser(targetUserId, adminId, {
        isCredentialEnabled,
        setPasswordToken: tokenData.hashedToken,
        setPasswordRequestedAt: tokenData.requestedAt,
      }),
    );

    this.logger.info('User unsuspended by admin', { userId: targetUserId, unsuspendedBy: adminId });

    // Future: send set-password email (email subsystem removed)

    return toResponseVM(updated);
  }

  async reactivateUser(
    targetUserId: number,
    adminId: number,
    dto: ReactivateUserDTO,
    actorRoleLevel: number,
    canAssignPeerLevel: boolean,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException(`User with id ${targetUserId} not found`);
    }
    if (user.status !== UserStatus.INACTIVE) {
      throw new BadRequestException(
        `Cannot reactivate a user with status "${user.status}". Only INACTIVE users can be reactivated.`,
      );
    }

    const isCredentialEnabled = this.resolveCredentialFlag(dto.isCredentialEnabled);

    let roleIds = dto.roleIds;
    const usedDefault = !roleIds || roleIds.length === 0;
    if (usedDefault) {
      const hasExistingRoles = user.userRoles.length > 0;
      if (!hasExistingRoles) {
        roleIds = this.resolveRoleIds(undefined);
      }
    }

    if (roleIds) {
      if (usedDefault) {
        await this.validateRoleHierarchy(roleIds, actorRoleLevel, canAssignPeerLevel);
      }
      await this.validateRoleIds(roleIds);
    }

    const tokenData = isCredentialEnabled ? this.generateSetPasswordToken() : undefined;

    const updated = await this.withConcurrencyGuard(() =>
      this.userRepository.reactivateUser(targetUserId, adminId, {
        isCredentialEnabled,
        roleIds,
        setPasswordToken: tokenData?.hashedToken,
        setPasswordRequestedAt: tokenData?.requestedAt,
      }),
    );

    this.logger.info('User reactivated by admin', { userId: targetUserId, reactivatedBy: adminId });

    return toResponseVM(updated);
  }

  async restoreUser(
    targetUserId: number,
    adminId: number,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    const existing = await this.userRepository.findByIdIncludingDeleted(targetUserId);
    if (!existing) {
      throw new NotFoundException(`User with id ${targetUserId} not found`);
    }
    if (!existing.isDeleted) {
      throw new ConflictException(`User with id ${targetUserId} is not in trash`);
    }

    const updated = await this.withConcurrencyGuard(() =>
      this.userRepository.restoreUser(targetUserId, adminId),
    );

    fireAndForget(
      this.sessionCache.invalidateAllUserSessions(targetUserId),
      this.logger,
      `invalidate sessions for user ${targetUserId}`,
    );

    this.logger.info('User restored from trash', { userId: targetUserId, restoredBy: adminId });

    return toResponseVM(updated);
  }

  async deactivateUser(
    targetUserId: number,
    adminId: number,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    const user = await this.userRepository.findByIdForProviderSwitch(targetUserId);

    if (!user) {
      throw new NotFoundException(`User with id ${targetUserId} not found`);
    }

    if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.SUSPENDED) {
      throw new BadRequestException(
        `Cannot deactivate a user with status "${user.status}". Only ACTIVE or SUSPENDED users can be deactivated.`,
      );
    }

    const updated = await this.withConcurrencyGuard(() =>
      this.db.$transaction(async (tx) => {
        const updateData: Prisma.UserUncheckedUpdateInput = {
          status: UserStatus.INACTIVE,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          deactivatedAt: new Date(),
          deactivatedBy: adminId,
          suspendedAt: null,
          suspendedBy: null,
          isCredentialEnabled: false,
        };

        const needsCleanup = user.status === UserStatus.ACTIVE && user.isCredentialEnabled;
        const data = needsCleanup
          ? { ...updateData, ...this.buildCredentialCleanupData() }
          : updateData;

        if (needsCleanup) {
          await this.userRepository.deleteCredentialArtifacts(tx, targetUserId);
        }

        const result = await this.userRepository.deactivateUserInTx(tx, targetUserId, data);
        await this.sessionRepo.deleteAllByUserId(targetUserId, tx);
        return result;
      }),
    );

    fireAndForget(
      this.sessionCache.invalidateAllUserSessions(targetUserId),
      this.logger,
      `invalidate sessions for user ${targetUserId}`,
    );

    this.logger.info('User deactivated by admin', {
      userId: targetUserId,
      deactivatedBy: adminId,
    });

    return toResponseVM(updated);
  }

  async switchAuthProvider(
    targetUserId: number,
    dto: UpdateAuthProviderDTO,
    adminId: number,
    getOrFail: (id: number) => Promise<UserWithRoles>,
    toResponseVM: (user: UserWithRoles) => Promise<UserResponseVM>,
  ): Promise<UserResponseVM> {
    const user = await this.userRepository.findByIdForProviderSwitch(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isCredentialEnabled === dto.isCredentialEnabled) {
      const full = await getOrFail(targetUserId);
      return toResponseVM(full);
    }

    await this.checkProviderSwitchRateLimit(targetUserId);

    const bothDisabled = !dto.isCredentialEnabled;
    const credentialRemoved = user.isCredentialEnabled && !dto.isCredentialEnabled;
    const credentialAdded = !user.isCredentialEnabled && dto.isCredentialEnabled;

    await this.db.$transaction(async (tx) => {
      let updateData: Prisma.UserUpdateInput = {
        isCredentialEnabled: dto.isCredentialEnabled,
        ...(bothDisabled && {
          status: UserStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspendedByUser: { connect: { id: adminId } },
        }),
      };

      if (credentialRemoved) {
        updateData = { ...updateData, ...this.buildCredentialCleanupData() };
        await this.userRepository.deleteCredentialArtifacts(tx, targetUserId);
      }

      if (credentialAdded && !user.passwordHash) {
        const rawToken = this.tokenService.generateSecureToken();
        const tokenHash = this.tokenService.hashToken(rawToken);
        updateData.setPasswordToken = tokenHash;
        updateData.setPasswordRequestedAt = new Date();
      }

      await this.userRepository.updateAuthProviderInTx(tx as never, targetUserId, updateData);
      await this.sessionRepo.deleteAllByUserId(targetUserId, tx);
    });

    fireAndForget(
      this.sessionCache.invalidateAllUserSessions(targetUserId),
      this.logger,
      `invalidate sessions for user ${targetUserId}`,
    );

    this.logger.info('Auth provider switched for user', {
      userId: targetUserId,
      isCredentialEnabled: dto.isCredentialEnabled,
      suspended: bothDisabled,
    });

    const updated = await getOrFail(targetUserId);
    return toResponseVM(updated);
  }

  private async checkProviderSwitchRateLimit(targetUserId: number): Promise<void> {
    const windowStart = new Date(Date.now() - PROVIDER_SWITCH_WINDOW_MS);
    const count = await this.userRepository.countRecentProviderSwitches(targetUserId, windowStart);

    if (count >= PROVIDER_SWITCH_RATE_LIMIT) {
      throw new BadRequestException(
        'Too many auth provider changes for this user. Please try again later.',
      );
    }
  }

  private generateSetPasswordToken(): {
    rawToken: string;
    hashedToken: string;
    requestedAt: Date;
  } {
    const rawToken = this.tokenService.generateSecureToken();
    return {
      rawToken,
      hashedToken: this.tokenService.hashToken(rawToken),
      requestedAt: new Date(),
    };
  }

  private buildCredentialCleanupData(): Partial<Prisma.UserUpdateInput> {
    return {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorConfirmedAt: null,
      twoFactorAttempts: 0,
      twoFactorAttemptsLockout: null,
      twoFactorGracePeriodEnd: null,
    };
  }

  private async withConcurrencyGuard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new BadRequestException(CONCURRENT_STATUS_CHANGE_MSG);
      }
      throw error;
    }
  }

  private resolveCredentialFlag(credentialFlag?: boolean): boolean {
    return credentialFlag ?? true;
  }

  private resolveRoleIds(roleIds: number[] | undefined): number[] {
    if (roleIds && roleIds.length > 0) {
      return roleIds;
    }
    throw new BadRequestException('roleIds is required');
  }

  private async validateRoleHierarchy(
    roleIds: number[],
    actorRoleLevel: number,
    canAssignPeerLevel: boolean,
  ): Promise<void> {
    const roles = await this.db.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true, level: true },
    });

    const forbidden = roles.filter((r) =>
      r.level > actorRoleLevel ? true : r.level === actorRoleLevel && !canAssignPeerLevel,
    );
    if (forbidden.length > 0) {
      const names = forbidden.map((r) => `${r.name} (level ${r.level})`).join(', ');
      this.logger.debug(
        `Default role hierarchy check failed: actor level ${actorRoleLevel}, forbidden roles: ${names}`,
      );
      throw new ForbiddenException(
        'The default role is at or above your role level. Please specify roleIds explicitly or contact a higher-level admin.',
      );
    }
  }

  private async validateRoleIds(roleIds: number[]): Promise<void> {
    const roles = await this.rolesService.findNamesByIds(roleIds);
    const foundIds = new Set(roles.map((r) => r.id));
    const missingIds = roleIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new BadRequestException(`Role(s) not found: ${missingIds.join(', ')}`);
    }
  }

  private async assertNotInvitedUser(id: number, action: string): Promise<void> {
    const hasInvitation = await this.userRepository.hasInvitation(id);
    if (hasInvitation) {
      throw new BadRequestException(
        `Cannot ${action} an invited user. Use the invitations API to manage invited users.`,
      );
    }
  }

  private async getRejectedUserOrFail(id: number): Promise<UserWithRoles> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    if (user.status !== UserStatus.REJECTED) {
      throw new BadRequestException(
        `Cannot un-reject a user with status "${user.status}". Only REJECTED users can be un-rejected.`,
      );
    }

    await this.assertNotInvitedUser(id, 'un-reject');

    return user;
  }

  private async getPendingUserOrFail(
    id: number,
    action: string,
    pastParticiple: string,
  ): Promise<UserWithRoles> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException(
        `Cannot ${action} a user with status "${user.status}". Only PENDING users can be ${pastParticiple}.`,
      );
    }

    await this.assertNotInvitedUser(id, action);

    return user;
  }
}
