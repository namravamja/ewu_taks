import type { PermissionScope } from '@mediastar/core';

import type { IPermissionDetail } from '../../permissions/interfaces/permission-response.interface';

export type { IPermissionDetail };

export interface IRolePermissionDetail {
  readonly id: number;
  readonly scope: PermissionScope;
  readonly permission: IPermissionDetail;
}

export interface IRoleSummary {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly isBuiltIn: boolean;
}

export interface IRoleDetail extends IRoleSummary {
  readonly rolePermissions: readonly IRolePermissionDetail[];
}

export interface IRoleMutationResult {
  readonly id: number;
  readonly name: string;
}
