import type { ISearchableQuery } from '@mediastar/core';
import type { UserStatus } from '@mediastar/database';

type UserSortField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'lastLoginAt';

export interface IUsersQuery extends ISearchableQuery<UserSortField> {
  readonly roleId?: number[];
  readonly status?: UserStatus[];
  readonly createdAtFrom?: string;
  readonly createdAtTo?: string;
  readonly lastLoginAtFrom?: string;
  readonly lastLoginAtTo?: string;
}
