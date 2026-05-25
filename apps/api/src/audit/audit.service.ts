import { AppLoggerService } from '@mediastar/core';
import { DatabaseService } from '@mediastar/database';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import type { IAuditLogEntry } from './interfaces/audit-log-entry.interface';

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BUFFER_SIZE = 10_000;
const MAX_SHUTDOWN_RETRIES = 3;

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private buffer: IAuditLogEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(AuditService.name);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        this.logger.error('Unexpected flush error', { error: String(err) });
      });
    }, FLUSH_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    let retries = 0;
    while (this.buffer.length > 0 && retries < MAX_SHUTDOWN_RETRIES) {
      const before = this.buffer.length;
      await this.flush();
      if (this.buffer.length >= before) {
        retries++;
      } else {
        retries = 0;
      }
    }

    if (this.buffer.length > 0) {
      this.logger.error('Shutdown: dropping unflushed audit entries after max retries', {
        dropped: this.buffer.length,
      });
      this.buffer = [];
    }
  }

  log(entry: IAuditLogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush().catch((err) => {
        this.logger.error('Unexpected flush error', { error: String(err) });
      });
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    const entries = this.buffer.splice(0, BATCH_SIZE);

    try {
      await this.db.auditLog.createMany({
        data: entries.map((e) => ({
          userId: e.userId,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          changes: (e.changes ?? undefined) as
            | Record<string, string | number | boolean | null>
            | undefined,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
          correlationId: e.correlationId,
          severity: e.severity,
          description: e.description,
          resourceName: e.resourceName,
          httpMethod: e.httpMethod,
          httpPath: e.httpPath,
          statusCode: e.statusCode,
          duration: e.duration,
          targetUserId: e.targetUserId,
          outcome: e.outcome,
          sessionId: e.sessionId,
        })),
      });
    } catch (error) {
      this.logger.error('Failed to flush audit log entries, re-queuing', {
        count: entries.length,
        error: String(error),
      });
      this.buffer.unshift(...entries);

      if (this.buffer.length > MAX_BUFFER_SIZE) {
        const dropped = this.buffer.length - MAX_BUFFER_SIZE;
        this.buffer.splice(0, dropped);
        this.logger.warn('Audit buffer exceeded max size, dropping oldest entries', { dropped });
      }
    } finally {
      this.flushing = false;
    }
  }
}
