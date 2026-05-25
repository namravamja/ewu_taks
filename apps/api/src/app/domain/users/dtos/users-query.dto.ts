import { UserStatus } from '@mediastar/database';
import { IsNotBefore, OffsetPaginationDTO } from '@mediastar/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import type { IUsersQuery } from '../interfaces/users-query.interface';

export const USER_SORTABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'status',
  'createdAt',
  'updatedAt',
  'lastLoginAt',
] as const;
export type UserSortableField = (typeof USER_SORTABLE_FIELDS)[number];

export class UsersQueryDTO extends OffsetPaginationDTO implements IUsersQuery {
  @ApiPropertyOptional({ description: 'Search by name or email', example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by one or more role IDs',
    type: Number,
    isArray: true,
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  roleId?: number[];

  @ApiPropertyOptional({
    description: 'Filter by one or more account statuses',
    enum: UserStatus,
    enumName: 'UserStatus',
    isArray: true,
    example: [UserStatus.ACTIVE, UserStatus.PENDING],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsEnum(UserStatus, { each: true })
  status?: UserStatus[];

  @ApiPropertyOptional({
    description: 'Filter users created on or after this date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter users created on or before this date (ISO 8601)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  @IsNotBefore('createdAtFrom', {
    message: 'createdAtTo must not be before createdAtFrom',
  })
  createdAtTo?: string;

  @ApiPropertyOptional({
    description: 'Filter users who last logged in on or after this date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastLoginAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter users who last logged in on or before this date (ISO 8601)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  @IsNotBefore('lastLoginAtFrom', {
    message: 'lastLoginAtTo must not be before lastLoginAtFrom',
  })
  lastLoginAtTo?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: USER_SORTABLE_FIELDS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(USER_SORTABLE_FIELDS)
  @Type(() => String)
  sortBy?: UserSortableField;
}
