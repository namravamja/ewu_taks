import { PAGINATION_DEFAULTS } from '@mediastar/core';

import type { OffsetPaginatedResultVM } from '../dtos/offset-paginated-result.vm';
import type { OffsetPaginationDTO } from '../dtos/offset-pagination.dto';
import { buildSearchWhere } from './search.util';
import { buildSortBy } from './sort.util';

export interface PaginationArgs {
  skip: number;
  take: number;
}

export function buildPaginationArgs(query: OffsetPaginationDTO): PaginationArgs {
  const page = query.page ?? PAGINATION_DEFAULTS.PAGE;
  const limit = Math.min(query.limit ?? PAGINATION_DEFAULTS.LIMIT, PAGINATION_DEFAULTS.MAX_LIMIT);
  return { skip: (page - 1) * limit, take: limit };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  query: OffsetPaginationDTO,
): OffsetPaginatedResultVM<T> {
  const page = query.page ?? PAGINATION_DEFAULTS.PAGE;
  const limit = Math.min(query.limit ?? PAGINATION_DEFAULTS.LIMIT, PAGINATION_DEFAULTS.MAX_LIMIT);
  return {
    data,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export interface SearchablePaginationQuery extends OffsetPaginationDTO {
  search?: string;
  searchFields?: readonly string[];
  sortBy?: string;
}

export interface ListQueryResult {
  skip: number;
  take: number;
  orderBy: Record<string, 'asc' | 'desc'>;
  searchWhere: Record<string, unknown>;
}

export function buildListQuery<TField extends string>(
  query: SearchablePaginationQuery,
  searchableFields: readonly TField[],
  sortableFields: readonly TField[],
  defaultSortField: NoInfer<TField>,
): ListQueryResult {
  const { skip, take } = buildPaginationArgs(query);
  const sortDir: 'asc' | 'desc' = query.sort === 'desc' ? 'desc' : 'asc';
  const sortField = buildSortBy(
    query.sortBy as TField | undefined,
    sortableFields,
    defaultSortField,
  );
  return {
    skip,
    take,
    orderBy: { [sortField]: sortDir },
    searchWhere: buildSearchWhere(
      query.search,
      query.searchFields as TField[] | undefined,
      searchableFields,
    ),
  };
}
