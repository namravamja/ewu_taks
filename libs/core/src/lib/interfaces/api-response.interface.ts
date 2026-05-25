export interface IResponseMeta {
  timestamp: string;
  correlationId: string;
  message?: string;
}

export interface IApiResponse<T> {
  status: boolean;
  data: T;
  meta: IResponseMeta;
}
