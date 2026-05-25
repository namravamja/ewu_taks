import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { PrismaClientValidationError } from '@prisma/client/runtime/client';
import { Request, Response } from 'express';

import { getCorrelationId } from '../context/correlation-id';
import { ErrorCode } from '../enums/index';
import { IErrorResponse, IFieldError } from '../interfaces/index';
import { AppLoggerService } from '../logger/logger.service';

const DEFAULT_MESSAGE = 'Invalid data provided';

@Catch(PrismaClientValidationError)
export class PrismaValidationExceptionFilter implements ExceptionFilter {
  private static readonly INVALID_VALUE_RE = /Invalid value for argument `(\w+)`[^:]*: (.+)$/;
  private static readonly UNKNOWN_ARG_RE = /Unknown argument `(\w+)`/;
  private static readonly MISSING_ARG_RE = /Argument `(\w+)` is missing/;

  private static readonly FRIENDLY_MESSAGES: Record<string, string> = {
    DateTime: 'Please enter a valid date.',
    Int: 'Please enter a valid number.',
    Boolean: 'Please enter a valid boolean.',
    Float: 'Please enter a valid number.',
  };

  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(PrismaValidationExceptionFilter.name);
  }

  catch(exception: PrismaClientValidationError, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = getCorrelationId();
    const timestamp = new Date().toISOString();

    this.logger.warn(
      `Prisma validation error: ${request.method} ${request.url} - ${exception.message}`,
    );

    const errors = this.parseFieldErrors(exception.message);
    const message = this.buildMessage(errors);

    const body: IErrorResponse = {
      status: false,
      statusCode: HttpStatus.BAD_REQUEST,
      error: ErrorCode.VALIDATION_ERROR,
      message,
      ...(errors.length > 0 && { errors }),
      correlationId,
      timestamp,
    };

    response.status(HttpStatus.BAD_REQUEST).json(body);
  }

  private buildMessage(errors: IFieldError[]): string {
    if (errors.length === 0) return DEFAULT_MESSAGE;
    if (errors.length === 1) return errors[0].message;
    return `Validation failed for fields: ${errors.map((e) => e.field).join(', ')}`;
  }

  private parseFieldErrors(message: string): IFieldError[] {
    const errors: IFieldError[] = [];

    for (const line of message.split('\n')) {
      if (this.parseInvalidValue(line, errors)) continue;
      if (this.parseUnknownArg(line, errors)) continue;
      this.parseMissingArg(line, errors);
    }

    return errors;
  }

  private parseInvalidValue(line: string, errors: IFieldError[]): boolean {
    const match = PrismaValidationExceptionFilter.INVALID_VALUE_RE.exec(line);
    if (!match) return false;

    const field = match[1];
    const detail = match[2].trim();
    const message = this.toFriendlyMessage(detail);

    errors.push({ field, message });
    return true;
  }

  private toFriendlyMessage(detail: string): string {
    for (const [type, friendly] of Object.entries(
      PrismaValidationExceptionFilter.FRIENDLY_MESSAGES,
    )) {
      if (detail.includes(type)) return friendly;
    }
    return 'Please enter a valid value.';
  }

  private parseUnknownArg(line: string, errors: IFieldError[]): boolean {
    const match = PrismaValidationExceptionFilter.UNKNOWN_ARG_RE.exec(line);
    if (!match) return false;

    errors.push({ field: match[1], message: `Unknown argument '${match[1]}'` });
    return true;
  }

  private parseMissingArg(line: string, errors: IFieldError[]): boolean {
    const match = PrismaValidationExceptionFilter.MISSING_ARG_RE.exec(line);
    if (!match) return false;

    errors.push({ field: match[1], message: `Argument '${match[1]}' is missing` });
    return true;
  }
}
