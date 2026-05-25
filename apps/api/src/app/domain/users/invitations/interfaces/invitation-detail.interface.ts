import type { InviteStatus } from '@mediastar/database';

export interface IInviteTokenUser {
  readonly id: number;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly status: InviteStatus;
  readonly tokenExpiry: Date | null;
}

export interface IInvitationDetail {
  readonly id: number;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly status: InviteStatus;
  readonly acceptedAt: Date | null;
  readonly role: { readonly name: string } | null;
}

export interface ICreateInvitationData {
  readonly userEmail: string;
  readonly invitedBy: number;
  readonly tokenHash: string;
  readonly tokenExpiry: Date;
}
