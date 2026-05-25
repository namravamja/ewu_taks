import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

import { ResponseMetaVM } from '../dtos/api-response.vm';

export interface ApiWrappedResponseOptions {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Human-readable description for this response */
  description?: string;
  /**
   * The DTO/VM class representing the `data` payload.
   * Omit for inline schemas — pass `dataSchema` instead.
   */
  type?: Type;
  /** Whether `data` is an array of `type` (default: false) */
  isArray?: boolean;
  /**
   * Raw JSON-Schema for `data` when no class is available.
   * Ignored when `type` is provided.
   */
  dataSchema?: Record<string, unknown>;
}

/**
 * Documents the actual API response envelope produced by `TransformInterceptor`:
 * ```json
 * { "status": true, "data": <T>, "meta": { "correlationId", "timestamp" } }
 * ```
 */
export function ApiWrappedResponse(options: ApiWrappedResponseOptions): MethodDecorator {
  const { status = 200, description, type, isArray = false, dataSchema } = options;

  let dataProperty: Record<string, unknown>;
  if (type) {
    dataProperty = isArray
      ? { type: 'array', items: { $ref: getSchemaPath(type) } }
      : { $ref: getSchemaPath(type) };
  } else {
    dataProperty = dataSchema ?? { type: 'object' };
  }

  const extraModels: Type[] = [ResponseMetaVM];
  if (type) {
    extraModels.push(type);
  }

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          status: { type: 'boolean', example: true },
          data: dataProperty,
          meta: { $ref: getSchemaPath(ResponseMetaVM) },
        },
        required: ['status', 'data', 'meta'],
      },
    }),
  );
}
