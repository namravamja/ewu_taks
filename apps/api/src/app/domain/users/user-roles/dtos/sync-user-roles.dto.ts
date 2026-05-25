import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

import type { ISyncUserRoles } from '../../interfaces/sync-user-roles.interface';

export class SyncUserRolesDTO implements ISyncUserRoles {
  @ApiProperty({
    description: 'Desired role IDs for the user — the current roles will be reconciled to match',
    example: [1, 2],
    type: Number,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  readonly roleIds!: number[];
}
