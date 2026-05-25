import { ApiProperty } from '@nestjs/swagger';

import type { IPermissionDetail } from '../interfaces/permission-response.interface';

export class PermissionDetailVM implements IPermissionDetail {
  @ApiProperty({ description: 'Permission ID', example: 1 })
  readonly id!: number;

  @ApiProperty({ description: 'Module the permission belongs to', example: 'cases' })
  readonly module!: string;

  @ApiProperty({ description: 'Permitted action', example: 'read' })
  readonly action!: string;

  @ApiProperty({
    description: 'Human-readable description',
    example: 'View case details',
    nullable: true,
  })
  readonly description!: string | null;
}
