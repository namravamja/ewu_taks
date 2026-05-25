import { InviteStatus, UserStatus } from '@mediastar/database';
import type { IPopulatedUser, IRole } from '@mediastar/shared';

export interface IUserInvitationSummary {
  readonly status: InviteStatus;
  readonly invitedAt: Date;
  readonly tokenExpiresAt: Date | null;
  readonly acceptedAt: Date | null;
  readonly invitedBy: IPopulatedUser | null;
}

export interface IUserResponse {
  readonly id: number;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly roles: IRole[];
  readonly type: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly zip: string | null;
  readonly status: UserStatus;
  readonly lastLoginAt: Date | null;
  readonly reviewedBy: number | null;
  readonly reviewedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly isCredentialEnabled: boolean;
  readonly isTwoFactorEnabled: boolean;
  readonly isTwoFactorEnforced: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly invitation: IUserInvitationSummary | null;
}
