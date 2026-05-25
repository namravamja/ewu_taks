export interface ITwoFactorConfirm {
  readonly code: string;
}

export interface ITwoFactorVerify {
  readonly code: string;
  readonly trustDevice?: boolean;
}

export interface ITwoFactorDisable {
  readonly code: string;
}

export interface ITwoFactorStatus {
  readonly isEnabled: boolean;
  readonly confirmedAt: string | null;
  readonly backupCodesRemaining: number;
  readonly isEnforced: boolean;
  readonly gracePeriodEnd: string | null;
}

export interface ITwoFactorSetup {
  readonly secret: string;
  readonly qrCode: string;
}

export interface ITwoFactorBackupCodes {
  readonly backupCodes: string[];
}

export interface ITwoFactorStats {
  readonly totalUsers: number;
  readonly enabledCount: number;
  readonly enforcedCount: number;
  readonly gracePeriodCount: number;
  readonly expiredGraceCount: number;
}

export interface ITwoFactorLoginResponse {
  readonly requiresTwoFactor: true;
  readonly twoFactorToken: string;
  readonly expiresIn: number;
}
