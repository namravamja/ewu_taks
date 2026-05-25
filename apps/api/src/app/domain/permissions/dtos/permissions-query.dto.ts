import { ModuleName } from '@mediastar/core';
import { OffsetPaginationDTO } from '@mediastar/shared';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import type { IPermissionsQuery } from '../interfaces/permissions-query.interface';

export const PERMISSION_SEARCHABLE_FIELDS = ['module', 'action', 'description'] as const;
export type PermissionSearchableField = (typeof PERMISSION_SEARCHABLE_FIELDS)[number];

export const PERMISSION_SORTABLE_FIELDS = ['module', 'action', 'createdAt'] as const;
export type PermissionSortableField = (typeof PERMISSION_SORTABLE_FIELDS)[number];

export class PermissionsQueryDTO extends OffsetPaginationDTO implements IPermissionsQuery {
  @ApiPropertyOptional({
    description:
      'Search permissions by selected fields (defaults to module + action + description)',
    maxLength: 100,
    example: 'read',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiHideProperty()
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @IsIn(PERMISSION_SEARCHABLE_FIELDS, { each: true })
  searchFields?: PermissionSearchableField[];

  @ApiPropertyOptional({
    description: 'Filter by module',
    enum: ModuleName,
    enumName: 'ModuleName',
    example: 'cases',
  })
  @IsOptional()
  @IsEnum(ModuleName)
  module?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['module', 'action', 'createdAt'],
    default: 'module',
    example: 'module',
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(PERMISSION_SORTABLE_FIELDS)
  sortBy?: PermissionSortableField = 'module';
}
