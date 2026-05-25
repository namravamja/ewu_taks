import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';

import { getCorrelationId } from '../context/correlation-id';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';
import { IApiResponse } from '../interfaces/index';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, IApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<IApiResponse<T>> {
    if (context.getType() !== 'http') {
      return next.handle() as Observable<IApiResponse<T>>;
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle() as Observable<IApiResponse<T>>;
    }

    return next.handle().pipe(
      map((data): IApiResponse<T> => {
        if (this.isAlreadyWrapped(data)) {
          return data;
        }

        return {
          status: true,
          data,
          meta: {
            correlationId: getCorrelationId(),
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }

  private isAlreadyWrapped(data: unknown): data is IApiResponse<T> {
    if (data === null || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return typeof obj['status'] === 'boolean' && 'data' in obj && 'meta' in obj;
  }
}
