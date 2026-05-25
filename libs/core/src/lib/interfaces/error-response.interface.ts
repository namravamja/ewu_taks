import type { ErrorCode } from '../enums/index';

export interface IFieldError {
  field: string;
  message: string;
  constraints?: Record<string, string>;
}

export interface IErrorResponse {
  status: false;
  statusCode: number;
  error: ErrorCode;
  message: string;
  errors?: IFieldError[];
  data?: Record<string, unknown>;
  correlationId: string;
  timestamp: string;
}
