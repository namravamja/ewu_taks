import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ErrorResponseVM } from '../dtos/error-response.vm';

/**
 * Applies standard UNAUTHORIZED (401) and FORBIDDEN (403) error responses
 * to a controller class or individual method.
 */
export function ApiStandardErrors(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: ErrorResponseVM,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient permissions',
      type: ErrorResponseVM,
    }),
  );
}
