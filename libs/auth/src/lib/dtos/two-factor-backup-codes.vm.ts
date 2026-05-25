import { ApiProperty } from '@nestjs/swagger';

import type { ITwoFactorBackupCodes } from '../two-factor/two-factor.interface';

export class TwoFactorBackupCodesVM implements ITwoFactorBackupCodes {
  @ApiProperty({
    description: 'One-time use backup codes (store securely — shown only once)',
    example: ['ABCD-1234', 'WXYZ-5678'],
    type: String,
    isArray: true,
  })
  readonly backupCodes!: string[];
}
