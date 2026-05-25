import type { GeoLocationResult } from '@mediastar/core';
import type { Prisma } from '@mediastar/database';
import { ApiProperty } from '@nestjs/swagger';

export class SessionInfoVM {
  @ApiProperty({ description: 'Session ID', example: 42 })
  readonly id!: number;

  @ApiProperty({ description: 'Client IP address', nullable: true })
  readonly ipAddress!: string | null;

  @ApiProperty({
    description: 'Client user agent string',
    example: 'Mozilla/5.0',
    nullable: true,
  })
  readonly userAgent!: string | null;

  @ApiProperty({ description: 'Session creation timestamp' })
  readonly createdAt!: Date;

  @ApiProperty({ description: 'Session expiry timestamp' })
  readonly expiresAt!: Date;

  @ApiProperty({ description: 'Geo-location or other session metadata', nullable: true })
  readonly metadata!: Prisma.JsonValue;

  @ApiProperty({
    description: 'Parsed browser name and version (e.g. "Chrome 120")',
    nullable: true,
    example: 'Chrome 120',
  })
  readonly browser!: string | null;

  @ApiProperty({
    description: 'Parsed operating system (e.g. "Mac OS 14.0")',
    nullable: true,
    example: 'Mac OS 14.0',
  })
  readonly os!: string | null;

  @ApiProperty({
    description: 'Parsed device type (e.g. "Mobile", "Tablet")',
    nullable: true,
    example: null,
  })
  readonly device!: string | null;

  @ApiProperty({
    description: 'Approximate location derived from IP geolocation',
    nullable: true,
    example: { city: 'Cheney', region: 'WA', country: 'US' },
  })
  readonly location!: GeoLocationResult | null;
}
