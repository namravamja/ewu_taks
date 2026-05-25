export interface IBasePaginationParams {
  limit?: number;
  sort?: 'asc' | 'desc';
}

export interface IBasePaginatedResponse<T> {
  data: T[];
  limit: number;
}
