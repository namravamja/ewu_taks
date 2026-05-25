import { AtLeastOneOf } from '@mediastar/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, Equals, IsArray, IsBoolean, IsInt, IsOptional } from 'class-validator';

import type { ITwoFactorEnforcement } from '../interfaces/two-factor-enforcement.interface';

@AtLeastOneOf(['userIds', 'all'])
export class TwoFactorEnforcementDTO implements ITwoFactorEnforcement {
  @ApiProperty({
    description: 'Whether to enforce (true) or de-enforce (false) 2FA',
    example: true,
  })
  @IsBoolean()
  readonly enforce!: boolean;

  @ApiPropertyOptional({
    description: 'Specific user IDs to enforce/de-enforce 2FA for',
    example: [1, 2, 3],
    type: [Number],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  readonly userIds?: number[];

  @ApiPropertyOptional({
    description: 'Apply to all users (must be true when provided)',
    example: true,
  })
  @IsOptional()
  @Equals(true, { message: 'all must be true when provided' })
  readonly all?: boolean;
}
