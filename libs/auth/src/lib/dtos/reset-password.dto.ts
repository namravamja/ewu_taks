import { SensitiveField } from '@mediastar/core';
import { IsValidPassword, Match } from '@mediastar/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import type { IResetPassword } from '../interfaces/reset-password.interface';

export class ResetPasswordDTO implements IResetPassword {
  @SensitiveField()
  @ApiProperty({ description: 'One-time reset token from the password reset email' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-f]{64}$/, { message: 'Invalid token format' })
  readonly token!: string;

  @SensitiveField()
  @IsValidPassword(
    'New password (min 8 chars, must include uppercase, lowercase, number, and special character)',
  )
  readonly newPassword!: string;

  @SensitiveField()
  @ApiProperty({ description: 'Must match newPassword', format: 'password' })
  @IsString()
  @Match('newPassword')
  readonly confirmPassword!: string;
}
