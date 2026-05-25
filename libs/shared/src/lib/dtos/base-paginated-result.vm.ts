import type { IBasePaginatedResponse } from '@mediastar/core';
import { ApiProperty } from '@nestjs/swagger';

export abstract class BasePaginatedResultVM<T> implements IBasePaginatedResponse<T> {
  @ApiProperty({ description: 'Array of items for the current page', isArray: true })
  data: T[];

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;
}
