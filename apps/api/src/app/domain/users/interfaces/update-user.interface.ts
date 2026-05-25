export interface IUpdateUser {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zip?: string;

  // Admin-only fields
  readonly roleIds?: number[];
  readonly isCredentialEnabled?: boolean;
}
