import type { ISearchableQuery } from '@mediastar/core';

export interface IRolesQuery extends ISearchableQuery<
  'name' | 'createdAt',
  'name' | 'description'
> {
  readonly isBuiltIn?: boolean;
}
