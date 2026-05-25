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
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import type { IUpdateUser } from '../interfaces/update-user.interface';

export class UpdateUserDTO implements IUpdateUser {
  @ApiPropertyOptional({ description: 'First name', maxLength: 100, example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', maxLength: 100, example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number', maxLength: 20, example: '1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'City', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'State', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP code', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zip?: string;

  // ── Admin-only fields ──────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Role IDs to assign (admin only — reconciled via diff)',
    type: Number,
    isArray: true,
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  roleIds?: number[];

  @ApiPropertyOptional({
    description: 'Enable credential (password) login (admin only)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isCredentialEnabled?: boolean;
}
