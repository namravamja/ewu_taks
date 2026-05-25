export interface IUnrejectUser {
  readonly reactivate: boolean;
  readonly roleIds?: number[];
  readonly isCredentialEnabled?: boolean;
}
