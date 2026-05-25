import { type IPaginationParams, PAGINATION_DEFAULTS } from '@mediastar/core';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

import { BasePaginationDTO } from './base-pagination.dto';

export class OffsetPaginationDTO extends BasePaginationDTO implements IPaginationParams {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: PAGINATION_DEFAULTS.PAGE,
    example: PAGINATION_DEFAULTS.PAGE,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = PAGINATION_DEFAULTS.PAGE;
}
