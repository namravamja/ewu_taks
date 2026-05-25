import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

import type { IForgotPassword } from '../interfaces/forgot-password.interface';

export class ForgotPasswordDTO implements IForgotPassword {
  @ApiProperty({
    description: 'Email address associated with the account',
    example: 'pqr@domain.com',
  })
  @IsEmail()
  readonly email!: string;
}
