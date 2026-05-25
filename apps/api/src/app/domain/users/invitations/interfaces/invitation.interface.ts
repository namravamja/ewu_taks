import type { InviteStatus } from '@mediastar/database';
import type { IPasswordRequest, IPopulatedUser } from '@mediastar/shared';

export interface ISendInviteRequest {
  readonly email: string;
  readonly roleIds: number[];
  readonly firstName?: string;
  readonly lastName?: string;
  readonly isCredentialEnabled?: boolean;
}

export type IAcceptInviteRequest = IPasswordRequest;

export interface IInvitationResponse {
  readonly id: number;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly status: InviteStatus | null;
  readonly createdAt: Date;
  readonly invitedBy: IPopulatedUser | null;
}

export interface IInviteValidationResponse {
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly valid: boolean;
}
