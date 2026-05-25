import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { AppLoggerService } from '../logger/logger.service';

const SKIP_PATHS = new Set([
  '/health',
  '/health/liveness',
  '/health/readiness',
  '/api/health',
  '/api/health/liveness',
  '/api/health/readiness',
]);
const SKIP_EXTENSIONS = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i;

function shouldSkipLogging(url: string): boolean {
  return SKIP_PATHS.has(url) || SKIP_EXTENSIONS.test(url);
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    if (shouldSkipLogging(url)) {
      return next.handle();
    }
    const ip = request.ip ?? 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          this.logger.info(`← ${method} ${url} ${response.statusCode} +${duration}ms`, {
            method,
            url,
            statusCode: response.statusCode,
            duration,
            ip,
          });
        },
        error: (error: Error) => {
          const duration = Date.now() - start;
          this.logger.error(`← ${method} ${url} ERROR +${duration}ms — ${error.message}`, {
            method,
            url,
            duration,
            ip,
            stack: error.stack,
          });
        },
      }),
    );
  }
}
