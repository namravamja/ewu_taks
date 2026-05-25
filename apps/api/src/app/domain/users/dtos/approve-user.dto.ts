import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

import type { IApproveUser } from '../interfaces/approve-user.interface';

export class ApproveUserDTO implements IApproveUser {
  @ApiPropertyOptional({
    description:
      'Role IDs to assign to the user. If omitted, the default role from admin settings is used.',
    example: [1],
    type: Number,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  readonly roleIds?: number[];

  @ApiPropertyOptional({ description: 'Enable credential (password) auth', example: true })
  @IsOptional()
  @IsBoolean()
  readonly isCredentialEnabled?: boolean;
}
