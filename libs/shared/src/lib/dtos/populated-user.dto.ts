import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import type { IPopulatedUser } from '../interfaces/populated-user.interface';

export class PopulatedUserDto implements IPopulatedUser {
  @ApiProperty({ description: 'User identifier', example: 12 })
  @Expose()
  id: number;

  @ApiProperty({ description: 'User first name', example: 'Jane', nullable: true })
  @Expose()
  firstName: string | null;

  @ApiProperty({ description: 'User last name', example: 'Doe', nullable: true })
  @Expose()
  lastName: string | null;

  @ApiProperty({ description: 'User email address', example: 'jane.doe@example.com' })
  @Expose()
  email: string;
}
