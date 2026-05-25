import type { IPaginationParams } from '@mediastar/core';
import type { InviteStatus } from '@mediastar/database';

export interface IInvitationsQuery extends IPaginationParams {
  readonly inviteStatus?: InviteStatus;
}
