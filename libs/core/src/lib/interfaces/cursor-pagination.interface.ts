import type { IBasePaginatedResponse, IBasePaginationParams } from './base-pagination.interface';

export interface ICursorPaginationParams extends IBasePaginationParams {
  cursor?: string;
}

export interface ICursorPaginatedResponse<T> extends IBasePaginatedResponse<T> {
  nextCursor: string | null;
  previousCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
