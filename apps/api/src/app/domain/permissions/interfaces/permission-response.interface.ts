export interface IPermissionDetail {
  readonly id: number;
  readonly module: string;
  readonly action: string;
  readonly description: string | null;
}
