import { PermissionScope } from '@mediastar/core';
import { ApiProperty } from '@nestjs/swagger';

import { PermissionDetailVM } from '../../permissions/dtos/permission-response.vm';
import type {
  IRoleDetail,
  IRoleMutationResult,
  IRolePermissionDetail,
  IRoleSummary,
} from '../interfaces/role-response.interface';

export { PermissionDetailVM };

export class RolePermissionDetailVM implements IRolePermissionDetail {
  @ApiProperty({ description: 'Role-permission assignment ID', example: 10 })
  readonly id!: number;

  @ApiProperty({
    description: 'Permission scope',
    enum: PermissionScope,
    enumName: 'PermissionScope',
    example: PermissionScope.ALL,
  })
  readonly scope!: PermissionScope;

  @ApiProperty({ description: 'Permission details', type: PermissionDetailVM })
  readonly permission!: PermissionDetailVM;
}

export class RoleSummaryVM implements IRoleSummary {
  @ApiProperty({ description: 'Role ID', example: 1 })
  readonly id!: number;

  @ApiProperty({ description: 'Role name', example: 'Admin' })
  readonly name!: string;

  @ApiProperty({
    description: 'Role description',
    example: 'Full system access',
    nullable: true,
  })
  readonly description!: string | null;

  @ApiProperty({ description: 'Whether the role is system-defined', example: true })
  readonly isBuiltIn!: boolean;
}

export class RoleDetailVM extends RoleSummaryVM implements IRoleDetail {
  @ApiProperty({
    description: 'Permissions assigned to this role',
    type: [RolePermissionDetailVM],
    isArray: true,
  })
  readonly rolePermissions!: RolePermissionDetailVM[];
}

export class RoleMutationResultVM implements IRoleMutationResult {
  @ApiProperty({ description: 'Role ID', example: 1 })
  readonly id!: number;

  @ApiProperty({ description: 'Role name', example: 'Case Manager' })
  readonly name!: string;
}
