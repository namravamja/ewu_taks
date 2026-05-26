import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const DEFAULT_FILTER_OPTIONS_LIMIT = 20;
const MAX_FILTER_OPTIONS_LIMIT = 50;

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CaseLocationFilterOptionsQueryDTO {
  @ApiPropertyOptional({ description: 'Search term for filtering locations', example: 'new' })
  @Transform(({ value }: { value: unknown }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of location options to return',
    minimum: 1,
    maximum: MAX_FILTER_OPTIONS_LIMIT,
    default: DEFAULT_FILTER_OPTIONS_LIMIT,
    example: DEFAULT_FILTER_OPTIONS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FILTER_OPTIONS_LIMIT)
  limit?: number;
}