import { Inject, Injectable, LoggerService, Scope } from '@nestjs/common';
import * as winston from 'winston';

import { getCorrelationId } from '../context/correlation-id';
import { WINSTON_INSTANCE } from './logger.constants';
import { sanitizeValue } from './sanitizers/credential.sanitizer';

type LogLevel = 'info' | 'error' | 'warn' | 'debug' | 'verbose';
type LogFn = (message: string, meta: Record<string, unknown>) => void;

const LOG_LEVELS: ReadonlySet<string> = new Set<LogLevel>([
  'info',
  'error',
  'warn',
  'debug',
  'verbose',
]);

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private static readonly SUPPRESSED_CONTEXTS: ReadonlySet<string> = new Set([
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
  ]);

  private context?: string;

  constructor(@Inject(WINSTON_INSTANCE) private readonly logger: winston.Logger) {}

  setContext(name: string): void {
    this.context = name;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logMessage('info', message, meta);
  }

  error(message: string, metaOrError?: Record<string, unknown> | Error): void {
    const meta = this.extractErrorMeta(metaOrError);
    this.logMessage('error', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logMessage('warn', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logMessage('debug', message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.logMessage('verbose', message, meta);
  }

  // NestJS LoggerService interface methods for app.useLogger() compatibility
  log(message: string, ...optionalParams: unknown[]): void {
    const context = this.extractNestContext(optionalParams);
    if (context && AppLoggerService.SUPPRESSED_CONTEXTS.has(context)) return;
    this.logMessage('info', message, context ? { context } : undefined);
  }

  private logMessage(level: string, message: string, meta?: Record<string, unknown>): void {
    if (!LOG_LEVELS.has(level)) return;

    const sanitizedMessage = sanitizeValue(message) as string;
    const sanitized = meta ? (sanitizeValue(meta) as Record<string, unknown>) : {};
    const { context: metaContext, ...rest } = sanitized;
    const logFn = this.logger[level as LogLevel] as LogFn;
    logFn.call(this.logger, sanitizedMessage, {
      context: metaContext ?? this.context,
      correlationId: getCorrelationId(),
      ...rest,
    });
  }

  private extractErrorMeta(
    metaOrError?: Record<string, unknown> | Error,
  ): Record<string, unknown> | undefined {
    if (!metaOrError) {
      return undefined;
    }

    if (metaOrError instanceof Error) {
      return {
        errorName: metaOrError.name,
        errorMessage: metaOrError.message,
        stack: metaOrError.stack,
      };
    }

    return metaOrError;
  }

  private extractNestContext(optionalParams: unknown[]): string | undefined {
    const reversed = [...optionalParams].reverse();
    return reversed.find((p): p is string => typeof p === 'string');
  }
}
