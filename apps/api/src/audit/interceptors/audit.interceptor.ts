import {
  AUDIT_SEVERITY_MAP,
  AUDITABLE_KEY,
  AuditableMetadata,
  AuditSeverity,
  getCorrelationId,
  getSensitiveFields,
} from '@mediastar/core';
import type { IUserContext } from '@mediastar/shared';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

import { AuditService } from '../audit.service';

const REDACTED = '[REDACTED]';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const metadata = this.reflector.getAllAndOverride<AuditableMetadata | undefined>(
      AUDITABLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest();
    const response = httpCtx.getResponse<Response>();
    const user = request.user as IUserContext | undefined;
    const userId = user?.userId ?? null;
    const ipAddress = (request.ip as string) ?? undefined;
    const userAgent = (request.headers?.['user-agent'] as string) ?? undefined;
    const correlationId = getCorrelationId();
    const entityId = metadata.entityIdExtractor?.(request);

    const startTime = Date.now();
    const httpMethod = request.method as string;
    const httpPath = request.originalUrl as string;
    const severity = AUDIT_SEVERITY_MAP.get(metadata.action) ?? AuditSeverity.Info;
    const resourceName = metadata.resourceNameExtractor?.(request);

    const actor = userId != null ? `User #${String(userId)}` : 'anonymous';
    const description = metadata.descriptionTemplate
      ?.replace('{actor}', actor)
      .replace('{action}', metadata.action)
      .replace('{entityType}', metadata.entityType)
      .replace('{entityId}', entityId ?? 'unknown')
      .replace('{resourceName}', resourceName ?? 'unknown');

    const changes = this.captureChanges(request.body, metadata.dtoClass);

    const targetUserIdRaw = metadata.targetUserIdExtractor?.(request);
    const targetUserId = targetUserIdRaw != null ? Number(targetUserIdRaw) || null : undefined;

    const sessionId = user?.sessionId ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService.log({
            userId,
            action: metadata.action,
            entityType: metadata.entityType,
            entityId,
            changes,
            ipAddress,
            userAgent,
            correlationId,
            severity,
            description,
            resourceName,
            httpMethod,
            httpPath,
            statusCode: response.statusCode,
            duration: Date.now() - startTime,
            targetUserId,
            outcome: 'success',
            sessionId,
          });
        },
      }),
    );
  }

  /**
   * Captures request body as audit changes.
   *
   * Requires `dtoClass` to opt in — without it, body is never captured
   * (safe default that prevents accidentally logging passwords).
   * Fields marked with `@SensitiveField()` on the DTO are redacted.
   *
   * Note: `forbidNonWhitelisted: true` on the global `ValidationPipe`
   * rejects requests with unknown fields before `tap.next` fires, so
   * only DTO-valid keys reach the audit log.
   */
  private captureChanges(
    body: unknown,
    dtoClass?: abstract new (...args: unknown[]) => unknown,
  ): Record<string, unknown> | undefined {
    if (!dtoClass || !body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return undefined;
    }

    const sensitiveFields = getSensitiveFields(dtoClass);
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      // eslint-disable-next-line security/detect-object-injection -- key from Object.entries of trusted req.body
      redacted[key] = sensitiveFields.has(key) ? REDACTED : value;
    }

    return redacted;
  }
}
