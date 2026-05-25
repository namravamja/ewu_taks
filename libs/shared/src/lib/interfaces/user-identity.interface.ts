export interface IRole {
  readonly id: number;
  readonly name: string;
}

export interface IUserIdentity {
  userId: number;
  email: string;
  roles: IRole[];
  effectiveRoleLevel: number;
}
