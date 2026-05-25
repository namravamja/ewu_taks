import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorEnforcementResultVM {
  @ApiProperty({ description: 'Number of users affected by the enforcement change', example: 10 })
  readonly affectedCount!: number;
}
