import { AuditAction } from '@mediastar/core';

export interface IAuditLogEntry {
  userId: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  severity?: string;
  description?: string;
  resourceName?: string;
  httpMethod?: string;
  httpPath?: string;
  statusCode?: number;
  duration?: number;
  targetUserId?: number | null;
  outcome?: string;
  sessionId?: number | null;
}
