import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

import type { IUnrejectUser } from '../interfaces/unreject-user.interface';

export class UnrejectUserDTO implements IUnrejectUser {
  @ApiProperty({
    description:
      'If true, directly activate the user (requires roleIds or a default role in admin settings). If false, move back to PENDING.',
    example: false,
  })
  @IsBoolean()
  readonly reactivate!: boolean;

  @ApiPropertyOptional({
    description:
      'Role IDs to assign (used when reactivate=true). If omitted, the default role from admin settings is used.',
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
