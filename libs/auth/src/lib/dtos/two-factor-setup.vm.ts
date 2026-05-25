import { ApiProperty } from '@nestjs/swagger';

import type { ITwoFactorSetup } from '../two-factor/two-factor.interface';

export class TwoFactorSetupVM implements ITwoFactorSetup {
  @ApiProperty({
    description: 'Base32-encoded TOTP secret for manual entry',
    example: 'JBSWY3DPEHPK3PXP',
  })
  readonly secret!: string;

  @ApiProperty({
    description: 'QR code as a data URL (PNG) for scanning with an authenticator app',
  })
  readonly qrCode!: string;
}
