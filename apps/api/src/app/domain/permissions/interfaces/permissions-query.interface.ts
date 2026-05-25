import type { ISearchableQuery } from '@mediastar/core';

export interface IPermissionsQuery extends ISearchableQuery<
  'module' | 'action' | 'createdAt',
  'module' | 'action' | 'description'
> {
  readonly module?: string;
}
