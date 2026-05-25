import { UserStatus } from '@mediastar/database';
import type { IUserIdentity } from '@mediastar/shared';

export interface ICachedSession extends IUserIdentity {
  expiresAt: string; // ISO 8601 — Date doesn't survive JSON serialization
  status: UserStatus;
  isTwoFactorEnabled: boolean;
  isTwoFactorEnforced: boolean;
  twoFactorGracePeriodEnd: string | null;
}
