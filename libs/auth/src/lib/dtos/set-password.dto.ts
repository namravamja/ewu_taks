import { SensitiveField } from '@mediastar/core';
import { IsValidPassword, Match } from '@mediastar/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import type { ISetPassword } from '../interfaces/set-password.interface';

export class SetPasswordDTO implements ISetPassword {
  @SensitiveField()
  @ApiProperty({ description: 'One-time set-password token from the email' })
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
