import { TokenService } from '@mediastar/auth';
import { AppLoggerService } from '@mediastar/core';
import { InviteStatus, UserStatus } from '@mediastar/database';
import {
  buildPaginatedResult,
  buildPaginationArgs,
  type IUserContext,
  OffsetPaginatedResultVM,
  PasswordService,
} from '@mediastar/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RolesService } from '../../roles/roles.service';
import type { UserRoleVM } from '../user-roles/dtos';
import { UserRolesService } from '../user-roles/user-roles.service';
import { UsersRepository } from '../users.repository';
import { UsersService } from '../users.service';
import {
  AcceptInviteDTO,
  InvitationResponseVM,
  InvitationsQueryDTO,
  InviteValidationResponseVM,
  SendInviteDTO,
} from './dtos';
import type { IInvitationDetail, IInviteTokenUser } from './interfaces/invitation-detail.interface';
import { InvitationsRepository } from './invitations.repository';

const INVITE_EXPIRY_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly logger: AppLoggerService,
    private readonly userRolesService: UserRolesService,
  ) {
    this.logger.setContext(InvitationsService.name);
  }

  async sendInvite(dto: SendInviteDTO, currentUser: IUserContext): Promise<InvitationResponseVM> {
    const emailTaken = await this.usersService.existsByEmail(dto.email);
    if (emailTaken) throw new ConflictException('This email address already exists');

    const roles = await this.rolesService.findNamesByIds(dto.roleIds);
    const foundIds = new Set(roles.map((r) => r.id));
    const missingIds = dto.roleIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new BadRequestException(`Role(s) not found: ${missingIds.join(', ')}`);
    }

    const isCredentialEnabled = dto.isCredentialEnabled ?? true;

    const { hashedToken } = this.generateInviteToken();

    const invitation = await this.invitationsRepository.runTransaction(async (tx) => {
      await this.usersService.createInvitedUser(
        {
          email: dto.email,
          firstName: dto.firstName ?? null,
          lastName: dto.lastName ?? null,
          roleIds: dto.roleIds,
          assignedBy: currentUser.userId,
          isCredentialEnabled,
        },
        tx,
      );

      return this.invitationsRepository.createInvitation(
        {
          userEmail: dto.email,
          invitedBy: currentUser.userId,
          tokenHash: hashedToken,
          tokenExpiry: this.computeInviteExpiry(),
        },
        tx,
      );
    });

    // Future: send invitation email (email subsystem removed)

    return invitation;
  }

  async resendInvite(userId: number): Promise<InvitationResponseVM> {
    const invitation = await this.getOrFail(userId);
    if (invitation.status === InviteStatus.ACCEPTED) {
      throw new BadRequestException('Cannot resend an already accepted invitation');
    }
    if (invitation.status !== InviteStatus.PENDING && invitation.status !== InviteStatus.REVOKED) {
      throw new BadRequestException('Invite can only be resent for pending or revoked invitations');
    }

    const { hashedToken } = this.generateInviteToken();

    const updated = await this.invitationsRepository.runTransaction(async (tx) => {
      const result = await this.invitationsRepository.resendInvite(
        userId,
        hashedToken,
        this.computeInviteExpiry(),
        tx,
      );
      const updatedStatus = await this.usersRepository.setStatus(
        userId,
        UserStatus.INVITED,
        [UserStatus.INVITED, UserStatus.REVOKED],
        tx,
      );
      if (!updatedStatus) {
        throw new ConflictException('User status precondition not met');
      }
      return result;
    });

    // Future: send invitation email (email subsystem removed)

    return updated;
  }

  async revokeInvite(userId: number): Promise<InvitationResponseVM> {
    const invitation = await this.getOrFail(userId);
    if (invitation.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    return this.invitationsRepository.runTransaction(async (tx) => {
      const result = await this.invitationsRepository.revokeInvite(userId, tx);
      const updatedStatus = await this.usersRepository.setStatus(
        userId,
        UserStatus.REVOKED,
        UserStatus.INVITED,
        tx,
      );
      if (!updatedStatus) {
        throw new ConflictException('User status precondition not met');
      }
      return result;
    });
  }

  async validateToken(token: string): Promise<InviteValidationResponseVM> {
    const invitation = await this.findInvitationByToken(token);

    return {
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      valid: true,
    };
  }

  async acceptInvite(token: string, dto: AcceptInviteDTO): Promise<InvitationResponseVM> {
    const invitation = await this.findInvitationByToken(token);

    const hashedPassword = await this.passwordService.hash(dto.password);

    const result = await this.invitationsRepository.runTransaction(async (tx) => {
      await this.usersService.activateUser(invitation.id, hashedPassword, tx);
      return this.invitationsRepository.markAccepted(invitation.id, tx);
    });

    // Future: notify inviter of acceptance (notification subsystem removed)

    return result;
  }

  async findAll(
    query: InvitationsQueryDTO,
  ): Promise<OffsetPaginatedResultVM<InvitationResponseVM>> {
    const { skip, take } = buildPaginationArgs(query);

    const [data, total] = await this.invitationsRepository.findMany({
      skip,
      take,
      inviteStatus: query.inviteStatus,
      sortDir: query.sort ?? 'desc',
    });

    return buildPaginatedResult(data, total, query);
  }

  async syncRoles(
    userId: number,
    roleIds: number[],
    assigner: IUserContext,
  ): Promise<UserRoleVM[]> {
    const invitation = await this.getOrFail(userId);
    if (invitation.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Roles can only be updated for pending invitations');
    }
    return this.userRolesService.syncRoles(userId, roleIds, assigner);
  }

  private async findInvitationByToken(token: string): Promise<IInviteTokenUser> {
    const hashedToken = this.tokenService.hashToken(token);

    const invitation = await this.invitationsRepository.findByInviteToken(hashedToken);

    const invalidTokenMessage = 'Invalid or expired invitation token';

    if (!invitation) {
      throw new BadRequestException(invalidTokenMessage);
    }

    if (invitation.status !== InviteStatus.PENDING) {
      throw new BadRequestException(invalidTokenMessage);
    }

    if (!invitation.tokenExpiry || invitation.tokenExpiry < new Date()) {
      throw new BadRequestException(invalidTokenMessage);
    }

    return invitation;
  }

  private async getOrFail(userId: number): Promise<IInvitationDetail> {
    const invitation = await this.invitationsRepository.findById(userId);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    return invitation;
  }

  private generateInviteToken(): { rawToken: string; hashedToken: string } {
    const rawToken = this.tokenService.generateSecureToken();
    const hashedToken = this.tokenService.hashToken(rawToken);
    return { rawToken, hashedToken };
  }

  private computeInviteExpiry(): Date {
    return new Date(Date.now() + INVITE_EXPIRY_MS);
  }
}
