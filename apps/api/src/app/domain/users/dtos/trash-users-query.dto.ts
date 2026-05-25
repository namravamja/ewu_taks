import { UserStatus } from '@mediastar/database';
import { ListDeletedQueryDTO } from '@mediastar/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import type { ITrashUsersQuery } from '../interfaces/trash-users-query.interface';

export const TRASH_SORTABLE_FIELDS = ['firstName', 'lastName', 'email', 'deletedAt'] as const;
export type TrashSortableField = (typeof TRASH_SORTABLE_FIELDS)[number];

export class TrashUsersQueryDTO extends ListDeletedQueryDTO implements ITrashUsersQuery {
  @ApiPropertyOptional({
    description: 'Filter by one or more role IDs.',
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
    description: 'Filter by one or more account statuses.',
    enum: UserStatus,
    enumName: 'UserStatus',
    isArray: true,
    example: [UserStatus.INVITED, UserStatus.ACTIVE],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsEnum(UserStatus, { each: true })
  status?: UserStatus[];

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: TRASH_SORTABLE_FIELDS,
    example: 'deletedAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(TRASH_SORTABLE_FIELDS)
  @Type(() => String)
  sortBy?: TrashSortableField;
}
