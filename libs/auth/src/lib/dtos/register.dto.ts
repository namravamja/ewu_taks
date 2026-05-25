import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import type { IRegister } from '../interfaces/register.interface';

export class RegisterDTO implements IRegister {
  @ApiProperty({ description: 'User email address', maxLength: 255, example: 'pqr@domain.com' })
  @IsEmail()
  @MaxLength(255)
  readonly email!: string;

  @ApiProperty({ description: 'First name', maxLength: 100, example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly firstName!: string;

  @ApiProperty({ description: 'Last name', maxLength: 100, example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly lastName!: string;

  @ApiProperty({ description: 'reCAPTCHA v3 token' })
  @IsNotEmpty()
  @IsString()
  readonly captchaToken!: string;
}
