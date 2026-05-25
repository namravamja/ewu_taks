export interface ISelfActionGuardOptions {
  /** Route parameter name containing the target user ID (default: `'id'`). */
  readonly targetParam: string;
  /** Custom error message when the user attempts a self-action (optional). */
  readonly message?: string;
}
