import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

import { ResponseMetaVM } from '../dtos/api-response.vm';
import { CursorPaginatedResultVM } from '../dtos/cursor-paginated-result.vm';

export interface ApiCursorPaginatedWrappedResponseOptions {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Human-readable description for this response */
  description?: string;
  /** The DTO/VM class representing each item in the paginated `data` array */
  type: Type;
}

/**
 * Documents the API response envelope for cursor-paginated endpoints.
 *
 * Note: The schema properties below are manually defined and must stay
 * in sync with `CursorPaginatedResultVM`. If fields are added/removed/renamed
 * in that class, update the schema here accordingly.
 */
export function ApiCursorPaginatedWrappedResponse(
  options: ApiCursorPaginatedWrappedResponseOptions,
): MethodDecorator {
  const { status = 200, description, type } = options;

  return applyDecorators(
    ApiExtraModels(ResponseMetaVM, CursorPaginatedResultVM, type),
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
              limit: { type: 'number', example: 20 },
              nextCursor: { type: 'string', nullable: true, example: 'eyJpZCI6NDJ9' },
              previousCursor: { type: 'string', nullable: true, example: 'eyJpZCI6MX0' },
              hasNextPage: { type: 'boolean', example: true },
              hasPreviousPage: { type: 'boolean', example: false },
            },
            required: [
              'data',
              'limit',
              'nextCursor',
              'previousCursor',
              'hasNextPage',
              'hasPreviousPage',
            ],
          },
          meta: { $ref: getSchemaPath(ResponseMetaVM) },
        },
        required: ['status', 'data', 'meta'],
      },
    }),
  );
}
