import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { getCorrelationId } from '../context/correlation-id';
import { ErrorCode } from '../enums/index';
import { IErrorResponse, IFieldError } from '../interfaces/index';
import { AppLoggerService } from '../logger/logger.service';
import type { ValidationExceptionPayload } from './validation-exception.factory';

interface ExceptionDetails {
  statusCode: number;
  message: string;
  error: ErrorCode;
  errors?: IFieldError[];
  data?: Record<string, unknown>;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const contextType = host.getType();

    if (contextType !== 'http') {
      this.handleNonHttpException(exception, contextType);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = getCorrelationId();
    const timestamp = new Date().toISOString();

    const details = this.extractErrorDetails(exception);

    this.logHttpError(exception, request, details, correlationId, timestamp);

    const body: IErrorResponse = {
      status: false,
      statusCode: details.statusCode,
      error: details.error,
      message: details.message,
      ...(details.errors && { errors: details.errors }),
      ...(details.data && { data: details.data }),
      correlationId,
      timestamp,
    };

    response.status(details.statusCode).json(body);
  }

  private extractErrorDetails(exception: unknown): ExceptionDetails {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: ErrorCode.INTERNAL_ERROR,
      };
    }

    if (exception instanceof UnauthorizedException) {
      return {
        statusCode: exception.getStatus(),
        message: this.extractMessage(exception),
        error: ErrorCode.AUTHENTICATION_ERROR,
        ...this.extractDataField(exception),
      };
    }

    if (exception instanceof ForbiddenException) {
      return {
        statusCode: exception.getStatus(),
        message: this.extractMessage(exception),
        error: ErrorCode.AUTHORIZATION_ERROR,
        ...this.extractDataField(exception),
      };
    }

    const statusCode = exception.getStatus();

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return {
        statusCode,
        message: 'Too many requests, please try again later',
        error: ErrorCode.RATE_LIMIT_EXCEEDED,
      };
    }

    if (statusCode === HttpStatus.BAD_REQUEST && this.isValidationError(exception)) {
      const payload = exception.getResponse() as ValidationExceptionPayload;
      return {
        statusCode,
        message: payload.message,
        error: ErrorCode.VALIDATION_ERROR,
        errors: payload.validationErrors,
      };
    }

    if (statusCode === HttpStatus.BAD_REQUEST && this.isJsonParseError(exception)) {
      return {
        statusCode,
        message: 'Malformed JSON in request body',
        error: ErrorCode.JSON_PARSE_ERROR,
      };
    }

    return {
      statusCode,
      message: this.extractMessage(exception),
      error: this.mapStatusToErrorCode(statusCode),
      // Forward `errors` + `data` for Conflict (409) and similar structured responses
      ...(statusCode === HttpStatus.CONFLICT && this.extractErrorsField(exception)),
      ...(statusCode === HttpStatus.CONFLICT && this.extractDataField(exception)),
    };
  }

  private extractDataField(
    exception: HttpException,
  ): { data: Record<string, unknown> } | Record<string, never> {
    const response = exception.getResponse();
    if (typeof response === 'object' && 'data' in response) {
      return { data: (response as Record<string, unknown>)['data'] as Record<string, unknown> };
    }
    return {};
  }

  private extractErrorsField(
    exception: HttpException,
  ): { errors: IFieldError[] } | Record<string, never> {
    const response = exception.getResponse();
    if (
      typeof response === 'object' &&
      'errors' in response &&
      Array.isArray((response as Record<string, unknown>)['errors'])
    ) {
      return { errors: (response as Record<string, unknown>)['errors'] as IFieldError[] };
    }
    return {};
  }

  private isValidationError(exception: HttpException): boolean {
    const response = exception.getResponse();
    return (
      typeof response === 'object' &&
      'validationErrors' in response &&
      Array.isArray((response as ValidationExceptionPayload).validationErrors)
    );
  }

  // Heuristic: matches Express body-parser JSON error messages.
  private isJsonParseError(exception: HttpException): boolean {
    const message = this.extractMessage(exception);
    return /Unexpected .+ in JSON at position \d+|Unexpected end of JSON/i.test(message);
  }

  private extractMessage(exception: HttpException): string {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const responseMessage = (exceptionResponse as Record<string, unknown>)['message'];

    if (Array.isArray(responseMessage)) {
      return responseMessage.join('; ');
    }

    if (typeof responseMessage === 'string') {
      return responseMessage;
    }

    return exception.message;
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCode.INTERNAL_ERROR;
      default:
        return ErrorCode.HTTP_ERROR;
    }
  }

  private handleNonHttpException(exception: unknown, contextType: string): void {
    const message = exception instanceof Error ? exception.message : String(exception);
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, exception instanceof Error ? exception : { contextType });
    } else {
      this.logger.warn(message, { contextType });
    }
  }

  private logHttpError(
    exception: unknown,
    request: Request,
    details: ExceptionDetails,
    correlationId: string,
    timestamp: string,
  ): void {
    const meta = {
      correlationId,
      errorCode: details.error,
      errorName: exception instanceof Error ? exception.constructor.name : 'UnknownError',
      path: request.url,
      method: request.method,
      statusCode: details.statusCode,
      timestamp,
    };

    const msg = `${request.method} ${request.url} ${details.statusCode} - ${details.message}`;

    if (details.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        msg,
        exception instanceof Error ? { ...meta, stack: exception.stack } : meta,
      );
    } else {
      this.logger.warn(msg, meta);
    }
  }
}
