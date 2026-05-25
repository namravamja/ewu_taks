import type { IPopulatedUser } from '@mediastar/shared';

import type { IUserResponse } from './user-response.interface';

export interface IDeletedUserResponse extends IUserResponse {
  readonly deletedAt: Date;
  readonly deletedBy: IPopulatedUser | null;
}
