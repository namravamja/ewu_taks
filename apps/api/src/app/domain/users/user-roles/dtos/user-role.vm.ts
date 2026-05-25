import { ApiProperty } from '@nestjs/swagger';

import type { IUserRoleResponse } from '../interfaces/user-role-response.interface';

export class UserRoleVM implements IUserRoleResponse {
  @ApiProperty({ description: 'Role ID', example: 1 })
  readonly id!: number;

  @ApiProperty({ description: 'Role name', example: 'ADMIN' })
  readonly name!: string;

  @ApiProperty({ description: 'Role level', example: 80 })
  readonly level!: number;

  @ApiProperty({ description: 'When the role was created', type: Date })
  readonly createdAt!: Date;
}
