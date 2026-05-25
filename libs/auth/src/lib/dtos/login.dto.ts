import { SensitiveField } from '@mediastar/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import type { ILogin } from '../interfaces/login.interface';

export class LoginDTO implements ILogin {
  @ApiProperty({ description: 'User email address', example: 'pqr@domain.com' })
  @IsEmail()
  readonly email!: string;

  @SensitiveField()
  @ApiProperty({
    description: 'Account password (min 8 characters)',
    format: 'password',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  readonly password!: string;
}
