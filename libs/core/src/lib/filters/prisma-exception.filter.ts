import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Request, Response } from 'express';

import { getCorrelationId } from '../context/correlation-id';
import { ErrorCode } from '../enums/index';
import { IErrorResponse } from '../interfaces/index';
import { AppLoggerService } from '../logger/logger.service';

const PRISMA_ERROR_MAP: Record<
  string,
  { status: number; error: ErrorCode; messageFactory: (meta?: Record<string, unknown>) => string }
> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    error: ErrorCode.CONFLICT,
    messageFactory: (meta) => {
      const target = meta?.['target'];
      const field = Array.isArray(target) ? target[0] : undefined;
      return field
        ? `${String(field).charAt(0).toUpperCase() + String(field).slice(1)} already exists`
        : 'Unique constraint violation';
    },
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    error: ErrorCode.NOT_FOUND,
    messageFactory: () => 'Record not found',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    error: ErrorCode.CONFLICT,
    messageFactory: () => 'Related record not found',
  },
  P2014: {
    status: HttpStatus.CONFLICT,
    error: ErrorCode.CONFLICT,
    messageFactory: () => 'Relation violation',
  },
};

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(PrismaExceptionFilter.name);
  }

  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = getCorrelationId();
    const timestamp = new Date().toISOString();

    const mapping = PRISMA_ERROR_MAP[exception.code];

    if (mapping) {
      const message = mapping.messageFactory(exception.meta);
      this.logger.warn(`Prisma ${exception.code}: ${message} - ${request.method} ${request.url}`);

      const body: IErrorResponse = {
        status: false,
        statusCode: mapping.status,
        error: mapping.error,
        message,
        correlationId,
        timestamp,
      };

      response.status(mapping.status).json(body);
      return;
    }

    this.logger.error(
      `Prisma ${exception.code}: ${exception.message} - ${request.method} ${request.url}`,
      { code: exception.code, meta: this.sanitizeMeta(exception.meta), stack: exception.stack },
    );

    const body: IErrorResponse = {
      status: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: ErrorCode.DATABASE_ERROR,
      message: `Unexpected database error (${exception.code})`,
      correlationId,
      timestamp,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  /** Strip potentially sensitive fields from Prisma error metadata. */
  private sanitizeMeta(
    meta: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    const SAFE_KEYS = new Set(['target', 'field_name', 'model_name', 'relation_name', 'column']);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      sanitized[key] = SAFE_KEYS.has(key) ? value : '[REDACTED]'; // eslint-disable-line security/detect-object-injection
    }
    return sanitized;
  }
}
