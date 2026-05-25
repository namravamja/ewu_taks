import { DatabaseService, InviteStatus, Prisma, type TxClient } from '@mediastar/database';
import { type IPopulatedUser, POPULATED_USER_SELECT } from '@mediastar/shared';
import { Injectable } from '@nestjs/common';

import type { IInvitationResponse } from './interfaces/invitation.interface';
import type {
  ICreateInvitationData,
  IInvitationDetail,
  IInviteTokenUser,
} from './interfaces/invitation-detail.interface';

const INVITATION_SELECT = {
  userId: true,
  status: true,
  createdAt: true,
  user: { select: { email: true, firstName: true, lastName: true } },
  inviter: { select: POPULATED_USER_SELECT },
} satisfies Prisma.UserInvitationSelect;

const INVITE_TOKEN_SELECT = {
  userId: true,
  status: true,
  tokenExpiry: true,
  user: { select: { email: true, firstName: true, lastName: true } },
} satisfies Prisma.UserInvitationSelect;

const INVITATION_DETAIL_SELECT = {
  userId: true,
  status: true,
  acceptedAt: true,
  user: {
    select: {
      email: true,
      firstName: true,
      lastName: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  },
} satisfies Prisma.UserInvitationSelect;

type RawInvitationPayload = Prisma.UserInvitationGetPayload<{
  select: typeof INVITATION_SELECT;
}>;

type RawInviteTokenPayload = Prisma.UserInvitationGetPayload<{
  select: typeof INVITE_TOKEN_SELECT;
}>;

type RawInvitationDetailPayload = Prisma.UserInvitationGetPayload<{
  select: typeof INVITATION_DETAIL_SELECT;
}>;

function toInvitationResponse(raw: RawInvitationPayload): IInvitationResponse {
  const inviter: IPopulatedUser | null = raw.inviter
    ? {
        id: raw.inviter.id,
        firstName: raw.inviter.firstName,
        lastName: raw.inviter.lastName,
        email: raw.inviter.email,
      }
    : null;
  return {
    id: raw.userId,
    email: raw.user.email,
    firstName: raw.user.firstName,
    lastName: raw.user.lastName,
    status: raw.status,
    createdAt: raw.createdAt,
    invitedBy: inviter,
  };
}

function toInvitationDetail(raw: RawInvitationDetailPayload): IInvitationDetail {
  const firstRole = raw.user.userRoles[0];
  return {
    id: raw.userId,
    email: raw.user.email,
    firstName: raw.user.firstName,
    lastName: raw.user.lastName,
    status: raw.status,
    acceptedAt: raw.acceptedAt,
    role: firstRole ? { name: firstRole.role.name } : null,
  };
}

function toInviteTokenUser(raw: RawInviteTokenPayload): IInviteTokenUser {
  return {
    id: raw.userId,
    email: raw.user.email,
    firstName: raw.user.firstName,
    lastName: raw.user.lastName,
    status: raw.status,
    tokenExpiry: raw.tokenExpiry,
  };
}

interface InvitationQueryParams {
  skip: number;
  take: number;
  inviteStatus?: InviteStatus;
  sortDir: 'asc' | 'desc';
}

@Injectable()
export class InvitationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async createInvitation(data: ICreateInvitationData, tx?: TxClient): Promise<IInvitationResponse> {
    const client = tx ?? this.db;
    const invitation = await client.userInvitation.create({
      data: {
        user: { connect: { email: data.userEmail } },
        inviter: { connect: { id: data.invitedBy } },
        tokenHash: data.tokenHash,
        tokenExpiry: data.tokenExpiry,
        status: InviteStatus.PENDING,
      },
      select: INVITATION_SELECT,
    });

    return toInvitationResponse(invitation);
  }

  async findById(userId: number): Promise<IInvitationDetail | null> {
    const invitation = await this.db.userInvitation.findUnique({
      where: { userId },
      select: INVITATION_DETAIL_SELECT,
    });

    if (!invitation) return null;

    return toInvitationDetail(invitation);
  }

  async resendInvite(
    userId: number,
    hashedToken: string,
    expiry: Date,
    tx?: TxClient,
  ): Promise<IInvitationResponse> {
    const client = tx ?? this.db;
    const invitation = await client.userInvitation.update({
      where: { userId },
      data: {
        tokenHash: hashedToken,
        tokenExpiry: expiry,
        status: InviteStatus.PENDING,
      },
      select: INVITATION_SELECT,
    });

    return toInvitationResponse(invitation);
  }

  async revokeInvite(userId: number, tx?: TxClient): Promise<IInvitationResponse> {
    const client = tx ?? this.db;
    const invitation = await client.userInvitation.update({
      where: { userId },
      data: {
        status: InviteStatus.REVOKED,
        tokenHash: null,
        tokenExpiry: null,
      },
      select: INVITATION_SELECT,
    });

    return toInvitationResponse(invitation);
  }

  async markAccepted(userId: number, tx?: TxClient): Promise<IInvitationResponse> {
    const client = tx ?? this.db;
    const invitation = await client.userInvitation.update({
      where: { userId },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
        tokenHash: null,
        tokenExpiry: null,
      },
      select: INVITATION_SELECT,
    });

    return toInvitationResponse(invitation);
  }

  async findByInviteToken(hashedToken: string): Promise<IInviteTokenUser | null> {
    const invitation = await this.db.userInvitation.findUnique({
      where: { tokenHash: hashedToken },
      select: INVITE_TOKEN_SELECT,
    });

    if (!invitation) return null;

    return toInviteTokenUser(invitation);
  }

  async runTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }

  async findMany(params: InvitationQueryParams): Promise<[IInvitationResponse[], number]> {
    const { skip, take, inviteStatus, sortDir } = params;

    const where: Prisma.UserInvitationWhereInput = {
      ...(inviteStatus != null && { status: inviteStatus }),
    };

    const [data, total] = await Promise.all([
      this.db.userInvitation.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: sortDir },
        select: INVITATION_SELECT,
      }),
      this.db.userInvitation.count({ where }),
    ]);

    return [data.map((d) => toInvitationResponse(d)), total];
  }
}
