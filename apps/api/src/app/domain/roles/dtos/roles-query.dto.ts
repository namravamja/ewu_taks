import { OffsetPaginationDTO } from '@mediastar/shared';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import type { IRolesQuery } from '../interfaces/roles-query.interface';

export const ROLE_SEARCHABLE_FIELDS = ['name', 'description'] as const;
export type RoleSearchableField = (typeof ROLE_SEARCHABLE_FIELDS)[number];

export const ROLE_SORTABLE_FIELDS = ['name', 'createdAt'] as const;
export type RoleSortableField = (typeof ROLE_SORTABLE_FIELDS)[number];

export class RolesQueryDTO extends OffsetPaginationDTO implements IRolesQuery {
  @ApiPropertyOptional({
    description: 'Search roles by selected fields (defaults to name + description)',
    maxLength: 100,
    example: 'admin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiHideProperty()
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @IsIn(ROLE_SEARCHABLE_FIELDS, { each: true })
  searchFields?: RoleSearchableField[];

  @ApiPropertyOptional({ description: 'Filter by built-in status', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isBuiltIn?: boolean;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['name', 'createdAt'],
    default: 'name',
    example: 'name',
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(ROLE_SORTABLE_FIELDS)
  sortBy?: RoleSortableField = 'name';
}
