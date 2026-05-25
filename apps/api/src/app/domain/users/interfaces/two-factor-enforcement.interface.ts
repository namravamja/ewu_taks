export interface ITwoFactorEnforcement {
  readonly enforce: boolean;
  readonly userIds?: number[];
  readonly all?: boolean;
}
