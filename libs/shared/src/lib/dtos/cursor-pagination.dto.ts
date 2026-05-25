import type { ICursorPaginationParams } from '@mediastar/core';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { BasePaginationDTO } from './base-pagination.dto';

export class CursorPaginationDTO extends BasePaginationDTO implements ICursorPaginationParams {
  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page of results',
    example: 'eyJpZCI6NDJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
