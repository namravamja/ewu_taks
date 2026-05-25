import { ApiProperty } from '@nestjs/swagger';

import type { ITwoFactorStatus } from '../two-factor/two-factor.interface';

export class TwoFactorStatusVM implements ITwoFactorStatus {
  @ApiProperty({ description: 'Whether 2FA is currently enabled', example: true })
  readonly isEnabled!: boolean;

  @ApiProperty({
    description: 'When 2FA was confirmed (ISO 8601), or null if not enabled',
    example: '2026-03-15T10:00:00.000Z',
    nullable: true,
  })
  readonly confirmedAt!: string | null;

  @ApiProperty({ description: 'Number of unused backup codes remaining', example: 8 })
  readonly backupCodesRemaining!: number;

  @ApiProperty({
    description: 'Whether 2FA is admin-enforced for this user',
    example: false,
  })
  readonly isEnforced!: boolean;

  @ApiProperty({
    description: 'Grace period deadline (ISO 8601), or null if not applicable',
    example: '2026-03-22T10:00:00.000Z',
    nullable: true,
  })
  readonly gracePeriodEnd!: string | null;
}
