import { ErrorCode, type IErrorResponse, type IFieldError } from '@mediastar/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FieldErrorVM implements IFieldError {
  @ApiProperty({ description: 'Name of the field that failed validation', example: 'email' })
  field: string;

  @ApiProperty({ description: 'Human-readable error message', example: 'must be a valid email' })
  message: string;

  @ApiPropertyOptional({
    description: 'Constraint violations keyed by validator name',
    example: { isEmail: 'email must be an valid email' },
  })
  constraints?: Record<string, string>;
}

export class ErrorResponseVM implements IErrorResponse {
  @ApiProperty({ description: 'Always false for error responses', example: false })
  status: false;

  @ApiProperty({ description: 'HTTP status code', example: 400 })
  statusCode: number;

  @ApiProperty({
    description: 'Machine-readable error code',
    enum: ErrorCode,
    enumName: 'ErrorCode',
    example: ErrorCode.VALIDATION_ERROR,
  })
  error: ErrorCode;

  @ApiProperty({ description: 'Human-readable error message', example: 'Validation failed' })
  message: string;

  @ApiPropertyOptional({
    description: 'Field-level validation errors',
    type: FieldErrorVM,
    isArray: true,
  })
  errors?: FieldErrorVM[];

  @ApiPropertyOptional({
    description: 'Additional error data (e.g. session conflict details)',
    type: 'object',
    additionalProperties: true,
  })
  data?: Record<string, unknown>;

  @ApiProperty({
    description: 'Request correlation ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  correlationId: string;

  @ApiProperty({ description: 'ISO 8601 timestamp', example: '2026-03-09T12:00:00.000Z' })
  timestamp: string;
}
