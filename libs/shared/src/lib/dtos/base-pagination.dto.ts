import { type IBasePaginationParams, PAGINATION_DEFAULTS } from '@mediastar/core';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export abstract class BasePaginationDTO implements IBasePaginationParams {
  @ApiPropertyOptional({
    description: 'Items per page',
    minimum: 1,
    maximum: PAGINATION_DEFAULTS.MAX_LIMIT,
    default: PAGINATION_DEFAULTS.LIMIT,
    example: PAGINATION_DEFAULTS.LIMIT,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PAGINATION_DEFAULTS.MAX_LIMIT)
  @Type(() => Number)
  limit?: number = PAGINATION_DEFAULTS.LIMIT;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';
}
