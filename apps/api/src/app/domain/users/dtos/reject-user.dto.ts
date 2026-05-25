import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import type { IRejectUser } from '../interfaces/reject-user.interface';

export class RejectUserDTO implements IRejectUser {
  @ApiPropertyOptional({
    description: 'Reason for rejecting the registration',
    maxLength: 500,
    example: 'Insufficient information provided',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly reason?: string;
}
