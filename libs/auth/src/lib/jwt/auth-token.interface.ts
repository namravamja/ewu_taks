import type { UserStatus } from '@mediastar/database';
import { IRole } from '@mediastar/shared';

export interface IAuthTokenUser {
  readonly id: number;
  readonly email: string;
  readonly roles: IRole[];
  readonly status: UserStatus;
  readonly isTwoFactorRequired: boolean;
}

export interface IAuthToken {
  readonly user: IAuthTokenUser;
}
