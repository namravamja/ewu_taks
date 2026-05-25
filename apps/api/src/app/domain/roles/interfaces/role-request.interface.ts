import type { PermissionScope } from '@mediastar/core';

export interface IPermissionAssignment {
  readonly permissionId: number;
  readonly scope?: PermissionScope;
}

export interface ICreateRole {
  readonly name: string;
  readonly description?: string;
  readonly permissions: IPermissionAssignment[];
}

export interface IUpdateRole {
  readonly name?: string;
  readonly description?: string;
  readonly permissions?: IPermissionAssignment[];
}
