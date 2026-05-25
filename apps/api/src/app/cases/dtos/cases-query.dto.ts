import { OffsetPaginationDTO } from '@mediastar/shared';
import { PAGINATION_DEFAULTS } from '@mediastar/core';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { CaseSource, Priority } from '../../../../../../../ewu_task/libs/database/src/lib/generated/prisma/client';

import { CASE_DISPLAY_PROPERTIES, type CaseDisplayPropertyKey } from '../interfaces/case.interface';
import { CASE_ORDER_BY_FIELDS, type CaseOrderByField } from '../utils/cases-order.util';

export class CasesQueryDTO extends OffsetPaginationDTO {
  @ApiPropertyOptional({ description: 'Filter cases by stage ID', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  stageId?: number;

  @ApiPropertyOptional({ description: 'Search cases by subject', example: 'john doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    return String(value).trim();
  })
  search?: string;

  @ApiPropertyOptional({ description: 'Filter cases created on or after this date', example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAtFrom?: Date;

  @ApiPropertyOptional({ description: 'Filter cases created on or before this date', example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAtTo?: Date;

  @ApiPropertyOptional({
    description: 'Filter cases by priority',
    enum: Priority,
    isArray: true,
    example: [Priority.HIGH],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const values = Array.isArray(value) ? value : String(value).split(',');
    return values.map((item) => String(item).trim()).filter(Boolean);
  })
  @IsArray()
  @IsIn(Object.values(Priority), { each: true })
  priority?: Priority[];

  @ApiPropertyOptional({
    description: 'Filter cases by assignee IDs',
    isArray: true,
    example: [1, 2],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const values = Array.isArray(value) ? value : String(value).split(',');
    return values.map((item) => Number(String(item).trim()));
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  assigneeIds?: number[];

  @ApiPropertyOptional({
    description: 'Maximum cases to include per stage in grouped response',
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
  caseLimit?: number = PAGINATION_DEFAULTS.LIMIT;

  @IsOptional()
  @IsEnum(CaseSource, { each: true })
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const values = Array.isArray(value) ? value : String(value).split(',');
    return values.map((item) => String(item).trim()).filter(Boolean);
  })
  caseSource?: CaseSource[];

  @ApiPropertyOptional({
    description:
      'Case display fields to include in grouped responses (defaults to caseName + caseNumber + created + priority)',
    enum: CASE_DISPLAY_PROPERTIES.map((property) => property.key),
    isArray: true,
    example: CASE_DISPLAY_PROPERTIES.filter((property) => property.selected).map((property) => property.key),
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const values = Array.isArray(value) ? value : String(value).split(',');
    return values.map((item) => String(item).trim()).filter(Boolean);
  })
  @IsArray()
  @IsIn(CASE_DISPLAY_PROPERTIES.map((property) => property.key), { each: true })
  displayPropertiesFilter?: CaseDisplayPropertyKey[];

  @ApiPropertyOptional({
    description: 'Order grouped cases by created, priority, updated, or name',
    enum: CASE_ORDER_BY_FIELDS,
    example: 'created',
  })
  @IsOptional()
  @IsIn(CASE_ORDER_BY_FIELDS)
  @Type(() => String)
  orderBy?: CaseOrderByField;
}