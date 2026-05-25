import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import type { ISendInviteRequest } from '../interfaces/invitation.interface';

export class SendInviteDTO implements ISendInviteRequest {
  @ApiProperty({
    description: 'Email address to send the invitation to',
    example: 'pqr@domain.com',
  })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({
    description: 'Role IDs to assign to the invited user',
    example: [2],
    type: [Number],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  readonly roleIds!: number[];

  @ApiPropertyOptional({ description: 'First name of the invited user', example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly firstName?: string;

  @ApiPropertyOptional({ description: 'Last name of the invited user', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly lastName?: string;

  @ApiPropertyOptional({ description: 'Enable credential (password) auth', example: true })
  @IsOptional()
  @IsBoolean()
  readonly isCredentialEnabled?: boolean;
}
