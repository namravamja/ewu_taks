import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

import { ResponseMetaVM } from '../dtos/api-response.vm';
import { OffsetPaginatedResultVM } from '../dtos/offset-paginated-result.vm';

export interface ApiPaginatedWrappedResponseOptions {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Human-readable description for this response */
  description?: string;
  /** The DTO/VM class representing each item in the paginated `data` array */
  type: Type;
}

/**
 * Documents the API response envelope for paginated endpoints.
 *
 * Note: The schema properties below are manually defined and must stay
 * in sync with `OffsetPaginatedResultVM`. If fields are added/removed/renamed
 * in that class, update the schema here accordingly.
 * ```json
 * {
 *   "status": true,
 *   "data": {
 *     "data": [{ ...item }],
 *     "total": 100,
 *     "page": 1,
 *     "limit": 20,
 *     "totalPages": 5
 *   },
 *   "meta": { "correlationId": "...", "timestamp": "..." }
 * }
 * ```
 */
export function ApiPaginatedWrappedResponse(
  options: ApiPaginatedWrappedResponseOptions,
): MethodDecorator {
  const { status = 200, description, type } = options;

  return applyDecorators(
    ApiExtraModels(ResponseMetaVM, OffsetPaginatedResultVM, type),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          status: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(type) },
              },
              total: { type: 'number', example: 100 },
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 20 },
              totalPages: { type: 'number', example: 5 },
            },
            required: ['data', 'total', 'page', 'limit', 'totalPages'],
          },
          meta: { $ref: getSchemaPath(ResponseMetaVM) },
        },
        required: ['status', 'data', 'meta'],
      },
    }),
  );
}
