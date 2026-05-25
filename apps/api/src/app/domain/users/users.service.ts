import {
  RbacService,
  SessionCacheService,
  SessionRepository,
  TokenService,
  TwoFactorService,
} from '@mediastar/auth';
import {
  AppLoggerService,
  AuditAction,
  ModuleName,
  PermissionAction,
  PermissionScope,
} from '@mediastar/core';
import { DatabaseService, type Prisma, type TxClient } from '@mediastar/database';
import {
  buildPaginatedResult,
  type BulkTrashActionDTO,
  BulkTrashActionResultVM,
  fireAndForget,
  type IBulkTrashActionError,
  type IUserContext,
  OffsetPaginatedResultVM,
  PasswordService,
} from '@mediastar/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../../../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import {
  AdminChangeEmailDTO,
  AdminSetPasswordDTO,
  ApproveUserDTO,
  DeletedUserResponseVM,
  ReactivateUserDTO,
  TrashUsersQueryDTO,
  UnrejectUserDTO,
  UpdateAuthProviderDTO,
  UpdateUserDTO,
  UserResponseVM,
  UsersQueryDTO,
} from './dtos';
import type { ITwoFactorEnforcement } from './interfaces/two-factor-enforcement.interface';
import type { IUserInvitationSummary } from './interfaces/user-response.interface';
import { UserStatusService } from './services/user-status.service';
import { type DeletedUserWithRoles, UsersRepository, UserWithRoles } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly passwordService: PasswordService,
    private readonly logger: AppLoggerService,
    private readonly db: DatabaseService,
    private readonly sessionRepo: SessionRepository,
    private readonly sessionCache: SessionCacheService,
    private readonly statusService: UserStatusService,
    private readonly twoFactorService: TwoFactorService,
    private readonly rolesService: RolesService,
    private readonly auditService: AuditService,
    private readonly tokenService: TokenService,
    private readonly rbacService: RbacService,
  ) {
    this.logger.setContext(UsersService.name);
  }

  async updateCurrentUser(id: number, dto: UpdateUserDTO): Promise<UserResponseVM> {
    if (dto.roleIds !== undefined || dto.isCredentialEnabled !== undefined) {
      throw new BadRequestException(
        'Admin-only fields (roleIds, isCredentialEnabled) cannot be set via self-update',
      );
    }

    const existing = await this.getOrFail(id);

    if (Object.keys(dto).length === 0) {
      return this.toResponseVM(existing);
    }

    await this.userRepository.update(id, dto);

    this.logger.info('User updated own profile', { userId: id });

    return this.toResponseVM(await this.getOrFail(id));
  }

  async findById(id: number): Promise<UserResponseVM> {
    const user = await this.getOrFail(id);
    return this.toResponseVM(user);
  }

  async updateUser(id: number, dto: UpdateUserDTO, actorId: number): Promise<UserResponseVM> {
    const existing = await this.getOrFail(id);

    if (Object.keys(dto).length === 0) {
      return this.toResponseVM(existing);
    }

    const { roleIds, isCredentialEnabled, ...profileFields } = dto;

    const hasRoleChange = roleIds !== undefined;
    const hasProfileFieldChange = Object.keys(profileFields).length > 0;

    const providerState = await this.resolveProviderState(id, isCredentialEnabled);

    await this.db.$transaction(async (tx) => {
      if (hasProfileFieldChange) {
        await tx.user.update({ where: { id }, data: profileFields });
      }

      if (hasRoleChange && roleIds) {
        await this.userRepository.syncUserRoles(tx as never, id, roleIds, actorId);
      }

      if (providerState) {
        await this.applyProviderSwitch(tx as never, id, providerState, isCredentialEnabled);
        await this.sessionRepo.deleteAllByUserId(id, tx);
      }
    });

    this.emitUpdateAudit(id, actorId, {
      profileFields: hasProfileFieldChange ? profileFields : undefined,
      roleIds: hasRoleChange ? roleIds : undefined,
      providerState,
      isCredentialEnabled,
    });

    if (providerState) {
      fireAndForget(
        this.sessionCache.invalidateAllUserSessions(id),
        this.logger,
        `invalidate sessions for user ${id}`,
      );
    }

    this.logger.info('User updated', { userId: id, actorId });

    return this.toResponseVM(await this.getOrFail(id));
  }

  async listUsers(query: UsersQueryDTO): Promise<OffsetPaginatedResultVM<UserResponseVM>> {
    const [users, total] = await this.userRepository.findMany(query);
    return buildPaginatedResult(
      users.map((u) => this.toResponseVM(u)),
      total,
      query,
    );
  }

  async getFilterOptions(
    search?: string,
    limit = 20,
    cursorId?: number,
    includeInactive = false,
  ): Promise<{ value: number; label: string }[]> {
    return this.userRepository.findFilterOptions(search, limit, cursorId, includeInactive);
  }

  async softDelete(id: number, deletedBy: number): Promise<void> {
    await this.getOrFail(id);
    await this.userRepository.softDelete(id, deletedBy);
    this.logger.info('User soft-deleted', { userId: id, deletedBy });
  }

  async listDeletedUsers(
    query: TrashUsersQueryDTO,
  ): Promise<OffsetPaginatedResultVM<DeletedUserResponseVM>> {
    if (query.roleId && query.roleId.length > 0) {
      const found = await this.rolesService.findNamesByIds(query.roleId);
      const foundIds = new Set(found.map((r) => r.id));
      const missing = query.roleId.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new NotFoundException(`Role(s) not found: ${missing.join(', ')}`);
      }
    }

    const [users, total] = await this.userRepository.findDeletedUsers(query);
    const data = users.map((u) => this.toDeletedResponseVM(u));
    return buildPaginatedResult(data, total, query);
  }

  async findDeletedById(id: number): Promise<DeletedUserResponseVM> {
    const user = await this.getDeletedOrFail(id);
    return this.toDeletedResponseVM(user);
  }

  async restoreUser(targetUserId: number, adminId: number): Promise<UserResponseVM> {
    return this.statusService.restoreUser(targetUserId, adminId, async (user) =>
      this.toResponseVM(user),
    );
  }

  async bulkTrashAction(
    dto: BulkTrashActionDTO,
    actorId: number,
  ): Promise<BulkTrashActionResultVM> {
    if (dto.action === 'hard_delete') {
      throw new BadRequestException('Permanent deletion of users is not supported');
    }

    const failed: IBulkTrashActionError[] = [];

    const found = await this.userRepository.findDeletedByIds(dto.ids);
    const foundIds = new Set(found.map((u) => u.id));

    for (const id of dto.ids) {
      if (!foundIds.has(id)) {
        failed.push({ id, reason: 'not_found' });
      }
    }

    const eligible = dto.ids.filter((id) => foundIds.has(id));

    if (eligible.length === 0) {
      return { succeeded: [], failed };
    }

    await this.userRepository.bulkRestore(eligible, actorId);

    return { succeeded: eligible, failed };
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.userRepository.existsByEmail(email);
  }

  async updateTwoFactorEnforcement(
    dto: ITwoFactorEnforcement,
    actor: IUserContext,
  ): Promise<{ affectedCount: number }> {
    const isAll = dto.all === true;

    if (isAll) {
      const canEnforceAll = await this.rbacService.checkPermissionWithScopeForRoles(
        actor.roles.map((r) => r.id),
        ModuleName.Users,
        PermissionAction.Admin,
        PermissionScope.ALL,
      );
      if (!canEnforceAll) {
        throw new ForbiddenException('Insufficient permission to enforce 2FA for all users');
      }
    } else if (dto.userIds) {
      await this.assertNoHigherOrEqualRoleTargets(dto.userIds, actor);
    }

    const where = isAll ? {} : { id: { in: dto.userIds } };
    const gracePeriodEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
    let affectedCount = 0;

    if (dto.enforce) {
      affectedCount = await this.userRepository.enforceTwoFactor(where, gracePeriodEnd);
    } else {
      affectedCount = await this.userRepository.removeTwoFactorEnforcement(where);
    }

    if (isAll) {
      await this.sessionCache.invalidateAllSessions();
    } else if (dto.userIds) {
      await Promise.all(dto.userIds.map((id) => this.sessionCache.invalidateAllUserSessions(id)));
    }

    return { affectedCount };
  }

  async adminDisableTwoFactor(targetUserId: number): Promise<void> {
    await this.twoFactorService.adminDisable(targetUserId);
    await this.sessionCache.invalidateAllUserSessions(targetUserId);
  }

  async resetTwoFactor(targetUserId: number): Promise<void> {
    await this.twoFactorService.adminReset(targetUserId, true);
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
    return this.userRepository.createInvitedUser(data, tx);
  }

  async activateUser(userId: number, passwordHash: string, tx?: TxClient): Promise<void> {
    await this.userRepository.activateUser(userId, passwordHash, tx);
  }

  async setPassword(targetUserId: number, dto: AdminSetPasswordDTO): Promise<void> {
    await this.getOrFail(targetUserId);

    const hash = await this.passwordService.hash(dto.password);

    await this.db.$transaction(async (tx) => {
      await this.userRepository.updatePassword(targetUserId, hash, tx);
      await this.sessionRepo.deleteAllByUserId(targetUserId, tx);
    });

    fireAndForget(
      this.sessionCache.invalidateAllUserSessions(targetUserId),
      this.logger,
      `invalidate sessions for user ${targetUserId}`,
    );
    this.logger.info('Admin set password for user', { userId: targetUserId });
  }

  async switchAuthProvider(
    targetUserId: number,
    dto: UpdateAuthProviderDTO,
    adminId: number,
  ): Promise<UserResponseVM> {
    return this.statusService.switchAuthProvider(
      targetUserId,
      dto,
      adminId,
      (id) => this.getOrFail(id),
      async (user) => this.toResponseVM(user),
    );
  }

  async changeEmail(targetUserId: number, dto: AdminChangeEmailDTO): Promise<void> {
    const user = await this.getOrFail(targetUserId);

    if (user.email === dto.newEmail) {
      throw new BadRequestException('New email is the same as the current email');
    }

    const existing = await this.userRepository.findByEmail(dto.newEmail);

    if (existing) {
      throw new ConflictException('This email address already exists');
    }

    await this.db.$transaction(async (tx) => {
      await this.userRepository.updateEmail(targetUserId, dto.newEmail, tx);
      await this.sessionRepo.deleteAllByUserId(targetUserId, tx);
    });

    fireAndForget(
      this.sessionCache.invalidateAllUserSessions(targetUserId),
      this.logger,
      `invalidate sessions for user ${targetUserId}`,
    );

    // Future: send email-change notification (email subsystem removed)

    this.logger.info('Admin changed email for user', {
      userId: targetUserId,
      oldEmail: user.email,
      newEmail: dto.newEmail,
    });
  }

  async approveUser(
    targetUserId: number,
    adminId: number,
    dto: ApproveUserDTO,
    actorRoleLevel: number,
    canAssignPeerLevel: boolean,
  ): Promise<UserResponseVM> {
    return this.statusService.approveUser(
      targetUserId,
      adminId,
      dto,
      actorRoleLevel,
      canAssignPeerLevel,
      async (user) => this.toResponseVM(user),
    );
  }

  async rejectUser(
    targetUserId: number,
    adminId: number,
    reason?: string,
  ): Promise<UserResponseVM> {
    return this.statusService.rejectUser(targetUserId, adminId, reason, async (user) =>
      this.toResponseVM(user),
    );
  }

  async unrejectUser(
    targetUserId: number,
    adminId: number,
    dto: UnrejectUserDTO,
    actorRoleLevel: number,
    canAssignPeerLevel: boolean,
  ): Promise<UserResponseVM> {
    return this.statusService.unrejectUser(
      targetUserId,
      adminId,
      dto,
      actorRoleLevel,
      canAssignPeerLevel,
      async (user) => this.toResponseVM(user),
    );
  }

  async suspendUser(targetUserId: number, adminId: number): Promise<UserResponseVM> {
    return this.statusService.suspendUser(targetUserId, adminId, async (user) =>
      this.toResponseVM(user),
    );
  }

  async unsuspendUser(targetUserId: number, adminId: number): Promise<UserResponseVM> {
    return this.statusService.unsuspendUser(targetUserId, adminId, async (user) =>
      this.toResponseVM(user),
    );
  }

  async reactivateUser(
    targetUserId: number,
    adminId: number,
    dto: ReactivateUserDTO,
    actorRoleLevel: number,
    canAssignPeerLevel: boolean,
  ): Promise<UserResponseVM> {
    return this.statusService.reactivateUser(
      targetUserId,
      adminId,
      dto,
      actorRoleLevel,
      canAssignPeerLevel,
      async (user) => this.toResponseVM(user),
    );
  }

  async deactivateUser(targetUserId: number, adminId: number): Promise<UserResponseVM> {
    return this.statusService.deactivateUser(targetUserId, adminId, async (user) =>
      this.toResponseVM(user),
    );
  }

  private async assertNoHigherOrEqualRoleTargets(
    userIds: number[],
    actor: IUserContext,
  ): Promise<void> {
    if (actor.effectiveRoleLevel === 0) {
      throw new ForbiddenException('Your role does not have a defined hierarchy level');
    }

    const maxTargetLevel = await this.userRepository.findMaxRoleLevelByUserIds(userIds);

    if (maxTargetLevel !== null && maxTargetLevel >= actor.effectiveRoleLevel) {
      throw new ForbiddenException(
        'Cannot change 2FA enforcement for users at the same or higher role level',
      );
    }
  }

  private async resolveProviderState(
    id: number,
    isCredentialEnabled: boolean | undefined,
  ): Promise<ProviderSwitchState | undefined> {
    if (isCredentialEnabled === undefined) return undefined;

    const user = await this.userRepository.findByIdForProviderSwitch(id);
    if (!user) throw new NotFoundException('User not found');

    if (isCredentialEnabled === user.isCredentialEnabled) {
      return undefined;
    }

    return {
      credentialRemoved: user.isCredentialEnabled && !isCredentialEnabled,
      credentialAdded: !user.isCredentialEnabled && isCredentialEnabled,
      email: user.email,
      passwordHash: user.passwordHash,
    };
  }

  private async applyProviderSwitch(
    tx: TxClient,
    id: number,
    state: ProviderSwitchState,
    isCredentialEnabled: boolean | undefined,
  ): Promise<void> {
    let updateData: Prisma.UserUpdateInput = {
      isCredentialEnabled: isCredentialEnabled ?? undefined,
    };

    if (state.credentialRemoved) {
      updateData = { ...updateData, ...buildCredentialCleanupData() };
      await this.userRepository.deleteCredentialArtifacts(tx, id);
    }

    if (state.credentialAdded && !state.passwordHash) {
      const rawToken = this.tokenService.generateSecureToken();
      updateData.setPasswordToken = this.tokenService.hashToken(rawToken);
      updateData.setPasswordRequestedAt = new Date();
    }

    await this.userRepository.updateAuthProviderInTx(tx, id, updateData);
  }

  private emitUpdateAudit(
    id: number,
    actorId: number,
    mutations: {
      profileFields?: Record<string, unknown>;
      roleIds?: number[];
      providerState?: ProviderSwitchState;
      isCredentialEnabled?: boolean;
    },
  ): void {
    const entityId = String(id);

    if (mutations.profileFields) {
      this.auditService.log({
        userId: actorId,
        action: AuditAction.Update,
        entityType: 'user',
        entityId,
        targetUserId: id,
        description: `User #${actorId} updated profile fields for User #${id}`,
        changes: mutations.profileFields,
      });
    }

    if (mutations.roleIds) {
      this.auditService.log({
        userId: actorId,
        action: AuditAction.RoleSync,
        entityType: 'user',
        entityId,
        targetUserId: id,
        description: `User #${actorId} updated roles for User #${id}`,
        changes: { roleIds: mutations.roleIds },
      });
    }

    if (mutations.providerState) {
      this.auditService.log({
        userId: actorId,
        action: AuditAction.ProviderSwitch,
        entityType: 'user',
        entityId,
        targetUserId: id,
        description: `User #${actorId} switched auth provider for User #${id}`,
        changes: {
          isCredentialEnabled: mutations.isCredentialEnabled ?? null,
        },
      });
    }
  }

  private async getDeletedOrFail(id: number): Promise<DeletedUserWithRoles> {
    const user = await this.userRepository.findDeletedById(id);
    if (!user) {
      throw new NotFoundException('Deleted user not found');
    }
    return user;
  }

  private async getOrFail(id: number): Promise<UserWithRoles> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private toResponseVM(user: UserWithRoles): UserResponseVM {
    const { userRoles, invitation, ...fields } = user;

    return {
      ...fields,
      roles: userRoles.map((ur) => ur.role),
      invitation: mapInvitation(invitation),
    };
  }

  private toDeletedResponseVM(user: DeletedUserWithRoles): DeletedUserResponseVM {
    const { userRoles, deletedByUser, deletedAt, invitation, ...fields } = user;
    if (!deletedAt) {
      throw new Error(`User ${fields.id} has isDeleted=true but deletedAt is null`);
    }
    return {
      ...fields,
      deletedAt,
      roles: userRoles.map((ur) => ur.role),
      invitation: mapInvitation(invitation),
      deletedBy: deletedByUser
        ? {
            id: deletedByUser.id,
            firstName: deletedByUser.firstName,
            lastName: deletedByUser.lastName,
            email: deletedByUser.email,
          }
        : null,
    };
  }
}

interface ProviderSwitchState {
  credentialRemoved: boolean;
  credentialAdded: boolean;
  email: string;
  passwordHash: string | null;
}

function buildCredentialCleanupData(): Partial<Prisma.UserUpdateInput> {
  return {
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorConfirmedAt: null,
    twoFactorAttempts: 0,
    twoFactorAttemptsLockout: null,
    twoFactorGracePeriodEnd: null,
  };
}

type InvitationRow = NonNullable<UserWithRoles['invitation']>;

function mapInvitation(
  invitation: InvitationRow | null | undefined,
): IUserInvitationSummary | null {
  if (!invitation) return null;
  const inviter = invitation.inviter;
  return {
    status: invitation.status,
    invitedAt: invitation.createdAt,
    tokenExpiresAt: invitation.tokenExpiry,
    acceptedAt: invitation.acceptedAt,
    invitedBy: inviter
      ? {
          id: inviter.id,
          firstName: inviter.firstName,
          lastName: inviter.lastName,
          email: inviter.email,
        }
      : null,
  };
}
