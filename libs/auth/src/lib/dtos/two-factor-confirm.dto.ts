import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

import type { ITwoFactorConfirm } from '../two-factor/two-factor.interface';

export class TwoFactorConfirmDTO implements ITwoFactorConfirm {
  @ApiProperty({ description: '6-digit TOTP code from authenticator app', example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be a 6-digit number' })
  readonly code!: string;
}
