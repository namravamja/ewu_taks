import type { IApiResponse, IResponseMeta } from '@mediastar/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResponseMetaVM implements IResponseMeta {
  @ApiProperty({ description: 'ISO 8601 timestamp', example: '2026-03-09T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({
    description: 'Request correlation ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  correlationId: string;

  @ApiPropertyOptional({ description: 'Optional response message', example: 'Success' })
  message?: string;
}

export class ApiResponseVM<T> implements IApiResponse<T> {
  @ApiProperty({ description: 'Whether the request was successful', example: true })
  status: boolean;

  @ApiProperty({ description: 'Response payload' })
  data: T;

  @ApiProperty({ description: 'Response metadata', type: ResponseMetaVM })
  meta: ResponseMetaVM;
}
