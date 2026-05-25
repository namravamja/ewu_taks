import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import { AuditAction } from '../enums/audit-action.enum';

export const AUDITABLE_KEY = 'audit:auditable';

export interface AuditableMetadata {
  action: AuditAction;
  entityType: string;
  entityIdExtractor?: (req: Request) => string | undefined;
  resourceNameExtractor?: (req: Request) => string | undefined;
  descriptionTemplate?: string;
  dtoClass?: abstract new (...args: unknown[]) => unknown;
  targetUserIdExtractor?: (req: Request) => string | undefined;
}

/**
 * Marks a controller method for automatic audit logging via `AuditInterceptor`.
 *
 * @example
 * ```typescript
 * @Post()
 * @Auditable({
 *   action: AuditAction.Create,
 *   entityType: 'case',
 *   entityIdExtractor: (req) => req.params.id,
 * })
 * create(@Body() dto: CreateCaseDTO): Promise<CaseResponseDTO> {
 *   return this.caseService.create(dto);
 * }
 * ```
 */
export const Auditable = (metadata: AuditableMetadata): MethodDecorator =>
  SetMetadata(AUDITABLE_KEY, metadata);
