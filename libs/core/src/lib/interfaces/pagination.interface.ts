import type { IBasePaginatedResponse, IBasePaginationParams } from './base-pagination.interface';

export interface IPaginationParams extends IBasePaginationParams {
  page?: number;
}

export interface IPaginatedResponse<T> extends IBasePaginatedResponse<T> {
  total: number;
  page: number;
  totalPages: number;
}
