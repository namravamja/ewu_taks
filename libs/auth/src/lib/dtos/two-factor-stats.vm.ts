import { ApiProperty } from '@nestjs/swagger';

import type { ITwoFactorStats } from '../two-factor/two-factor.interface';

export class TwoFactorStatsVM implements ITwoFactorStats {
  @ApiProperty({ description: 'Total number of active users', example: 100 })
  readonly totalUsers!: number;

  @ApiProperty({ description: 'Users with 2FA enabled', example: 45 })
  readonly enabledCount!: number;

  @ApiProperty({ description: 'Users with admin-enforced 2FA', example: 60 })
  readonly enforcedCount!: number;

  @ApiProperty({ description: 'Users within their grace period', example: 10 })
  readonly gracePeriodCount!: number;

  @ApiProperty({
    description: 'Users with expired grace period who have not set up 2FA',
    example: 5,
  })
  readonly expiredGraceCount!: number;
}
