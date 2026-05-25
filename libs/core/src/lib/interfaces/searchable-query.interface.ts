import type { IPaginationParams } from './pagination.interface';

export interface ISearchableQuery<
  TSortField extends string = string,
  TSearchField extends string = string,
> extends IPaginationParams {
  readonly search?: string;
  readonly searchFields?: readonly TSearchField[];
  readonly sortBy?: TSortField;
}
