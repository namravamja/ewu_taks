import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IsNotBefore } from '../decorators/is-not-before.validator';
import { OffsetPaginationDTO } from './offset-pagination.dto';

/**
 * Shared base DTO for soft-deleted ("trash") list endpoints.
 *
 * Provides an inclusive ISO-8601 `deletedAt` date range with cross-field
 * validation (`deletedAtTo` cannot be before `deletedAtFrom`), plus a shared
 * `search` term contract (case-insensitive substring, 2–100 chars). Extend
 * this class for each trash list query DTO so the contract stays consistent
 * across entities — per-entity search fields are defined at the repository
 * layer.
 */
export class ListDeletedQueryDTO extends OffsetPaginationDTO {
  @ApiPropertyOptional({
    description: 'Case-insensitive substring search (2–100 chars). Empty or missing → skipped.',
    minLength: 2,
    maxLength: 100,
    example: 'jane',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.trim() || undefined;
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Records deleted on or after this date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  deletedAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Records deleted on or before this date (ISO 8601)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  @IsNotBefore('deletedAtFrom', {
    message: 'deletedAtTo must not be before deletedAtFrom',
  })
  deletedAtTo?: string;
}
