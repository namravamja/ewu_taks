import { SensitiveField } from '@mediastar/core';
import { IsValidPassword, Match } from '@mediastar/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import type { IChangePassword } from '../interfaces/change-password.interface';

export class ChangePasswordDTO implements IChangePassword {
  @SensitiveField()
  @IsValidPassword('Current account password')
  readonly currentPassword!: string;

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
