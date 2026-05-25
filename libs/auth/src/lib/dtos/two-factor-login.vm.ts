import { ApiProperty } from '@nestjs/swagger';

import type { ITwoFactorLoginResponse } from '../two-factor/two-factor.interface';

export class TwoFactorLoginVM implements ITwoFactorLoginResponse {
  @ApiProperty({ description: 'Indicates that 2FA verification is required', example: true })
  readonly requiresTwoFactor!: true;

  @ApiProperty({ description: 'Partial JWT token to present during 2FA verification' })
  readonly twoFactorToken!: string;

  @ApiProperty({ description: 'Seconds until the 2FA token expires', example: 300 })
  readonly expiresIn!: number;
}
