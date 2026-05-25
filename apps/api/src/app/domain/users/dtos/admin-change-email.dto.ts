import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

import type { IAdminChangeEmailRequest } from '../interfaces/admin-change-email.interface';

export class AdminChangeEmailDTO implements IAdminChangeEmailRequest {
  @ApiProperty({ description: 'New email address', example: 'pqr@domain.com' })
  @IsEmail()
  @IsNotEmpty()
  readonly newEmail!: string;
}
