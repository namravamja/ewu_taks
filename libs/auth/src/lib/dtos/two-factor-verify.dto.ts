import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

import type { ITwoFactorVerify } from '../two-factor/two-factor.interface';

export class TwoFactorVerifyDTO implements ITwoFactorVerify {
  @ApiProperty({
    description: '6-digit TOTP code or backup code (ABCD-1234 or legacy 8-hex format)',
    example: '123456',
  })
  @IsString()
  @Matches(/^(\d{6}|[a-f0-9]{8}|[A-Z]{4}-\d{4})$/, {
    message: 'code must be a 6-digit TOTP code or a valid backup code',
  })
  readonly code!: string;

  @ApiPropertyOptional({
    description: 'Remember this device for 30 days (skip 2FA on subsequent logins)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly trustDevice?: boolean = false;
}
