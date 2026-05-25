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

import type { IReactivateUser } from '../interfaces/reactivate-user.interface';

export class ReactivateUserDTO implements IReactivateUser {
  @ApiPropertyOptional({ description: 'Enable credential (password) auth', example: true })
  @IsOptional()
  @IsBoolean()
  readonly isCredentialEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Role IDs to assign (overrides existing roles)',
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
}
