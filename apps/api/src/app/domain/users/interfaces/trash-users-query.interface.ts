import type { ISearchableQuery } from '@mediastar/core';
import type { UserStatus } from '@mediastar/database';

type TrashSortField = 'firstName' | 'lastName' | 'email' | 'deletedAt';

export interface ITrashUsersQuery extends ISearchableQuery<TrashSortField> {
  readonly roleId?: number[];
  readonly status?: UserStatus[];
  readonly deletedAtFrom?: string;
  readonly deletedAtTo?: string;
}
