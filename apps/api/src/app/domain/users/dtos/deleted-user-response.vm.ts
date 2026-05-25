import { PopulatedUserDto } from '@mediastar/shared';
import { ApiProperty } from '@nestjs/swagger';

import type { IDeletedUserResponse } from '../interfaces/deleted-user-response.interface';
import { UserResponseVM } from './user-response.vm';

export class DeletedUserResponseVM extends UserResponseVM implements IDeletedUserResponse {
  @ApiProperty({ description: 'When the user was deleted', type: String, format: 'date-time' })
  readonly deletedAt!: Date;

  @ApiProperty({
    description: 'Admin who deleted this user',
    type: PopulatedUserDto,
    nullable: true,
  })
  readonly deletedBy!: PopulatedUserDto | null;
}
