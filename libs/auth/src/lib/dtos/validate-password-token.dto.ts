import { SensitiveField } from '@mediastar/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import type { IValidatePasswordToken } from '../interfaces/validate-password-token.interface';

export class ValidatePasswordTokenDTO implements IValidatePasswordToken {
  @SensitiveField()
  @ApiProperty({ description: 'One-time token from the password email link' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-f]{64}$/, { message: 'Invalid token format' })
  readonly token!: string;
}
