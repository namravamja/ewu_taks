export interface IScopeGuardOptions {
  /** Route parameter name containing the target user ID (default: `'id'`). */
  readonly targetParam: string;
  /** Custom error message when the user lacks `all` scope (optional). */
  readonly message?: string;
}
