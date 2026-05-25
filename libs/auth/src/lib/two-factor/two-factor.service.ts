import { randomBytes } from 'node:crypto';

import { DatabaseService, type TxClient } from '@mediastar/database';
import { EncryptionService, PasswordService } from '@mediastar/shared';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

import {
  DEFAULT_TWO_FACTOR_BACKUP_CODE_COUNT,
  DEFAULT_TWO_FACTOR_LOCKOUT_MS,
  DEFAULT_TWO_FACTOR_MAX_ATTEMPTS,
  DEFAULT_TWO_FACTOR_TOTP_ISSUER,
  DEFAULT_TWO_FACTOR_TOTP_WINDOW,
} from '../constants';
import { SessionRepository } from '../session/session.repository';
import { SessionCacheService } from '../session/session-cache.service';
import { UserRepository } from '../user/user.repository';
import { BackupCodeRepository } from './backup-code.repository';
import { TrustedDeviceRepository } from './trusted-device.repository';
import type {
  ITwoFactorBackupCodes,
  ITwoFactorSetup,
  ITwoFactorStats,
  ITwoFactorStatus,
} from './two-factor.interface';

const TWO_FA_ALREADY_ENABLED = 'Two-factor authentication is already enabled';
const TWO_FA_NOT_ENABLED = 'Two-factor authentication is not enabled';
const INVALID_CODE = 'Invalid verification code';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly db: DatabaseService,
    private readonly encryptionService: EncryptionService,
    private readonly passwordService: PasswordService,
    private readonly backupCodeRepo: BackupCodeRepository,
    private readonly trustedDeviceRepo: TrustedDeviceRepository,
    private readonly config: ConfigService,
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async generateSetup(userId: number, email: string): Promise<ITwoFactorSetup> {
    const existing = await this.userRepo.findTwoFactorSetupInfo(userId);

    if (existing?.isTwoFactorEnabled) {
      throw new BadRequestException(TWO_FA_ALREADY_ENABLED);
    }

    const totpIssuer =
      this.config.get<string>('app.twoFactor.totpIssuer') ?? DEFAULT_TWO_FACTOR_TOTP_ISSUER;
    const totp = new OTPAuth.TOTP({
      issuer: totpIssuer,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const secret = totp.secret.base32;
    const encryptedSecret = this.encryptionService.encrypt(secret);

    await this.userRepo.updateTwoFactorSecret(userId, {
      twoFactorSecret: encryptedSecret,
      twoFactorConfirmedAt: null,
      isTwoFactorEnabled: false,
    });

    const otpauthUri = totp.toString();
    const qrCode = await QRCode.toDataURL(otpauthUri);

    return { secret, qrCode };
  }

  async confirmSetup(userId: number, code: string, tx?: TxClient): Promise<ITwoFactorBackupCodes> {
    const user = await this.userRepo.findTwoFactorSetupInfo(userId);

    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Two-factor setup has not been initiated');
    }

    if (user.isTwoFactorEnabled) {
      throw new BadRequestException(TWO_FA_ALREADY_ENABLED);
    }

    const isValid = this.verifyTotpCode(user.twoFactorSecret, code);
    if (!isValid) {
      throw new UnauthorizedException(INVALID_CODE);
    }

    // Enable 2FA and generate backup codes in a transaction
    const plainCodes = this.generatePlainBackupCodes();
    const hashes = await Promise.all(plainCodes.map((c) => this.passwordService.hash(c)));

    const writeOps = async (client: TxClient): Promise<void> => {
      await this.userRepo.enableTwoFactor(userId, client);
      await this.backupCodeRepo.deleteAllByUserId(userId, client);
      await this.backupCodeRepo.createMany(userId, hashes, client);
    };

    if (tx) {
      await writeOps(tx);
    } else {
      await this.db.$transaction(writeOps);
    }

    return { backupCodes: plainCodes };
  }

  async verifyCode(userId: number, code: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const user = await this.userRepo.lockUserForTwoFactor(userId, tx);

      if (!user.twoFactorSecret) return false;

      return this.verifyTotpCode(user.twoFactorSecret, code);
    });
  }

  async verifyBackupCode(userId: number, code: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      await this.userRepo.lockUserForTwoFactor(userId, tx);

      const unusedCodes = await this.backupCodeRepo.findUnusedByUserId(userId, tx);
      if (unusedCodes.length === 0) return false;

      const results = await Promise.all(
        unusedCodes.map(async (backup) => ({
          backup,
          isMatch: await this.passwordService.compare(code, backup.hash),
        })),
      );
      const matchedBackup = results.find((r) => r.isMatch)?.backup ?? null;

      if (!matchedBackup) return false;

      return this.backupCodeRepo.markUsedIfUnused(matchedBackup.id, tx);
    });
  }

  async disable(userId: number, code: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const user = await this.userRepo.lockUserForTwoFactor(userId, tx);

      if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestException(TWO_FA_NOT_ENABLED);
      }

      if (user.isTwoFactorEnforced) {
        throw new BadRequestException(
          'Two-factor authentication cannot be disabled while it is enforced by your organization',
        );
      }

      const isValid = this.verifyTotpCode(user.twoFactorSecret, code);
      if (!isValid) {
        throw new UnauthorizedException(INVALID_CODE);
      }

      await this.userRepo.disableTwoFactor(userId, tx);
      await this.backupCodeRepo.deleteAllByUserId(userId, tx);
      await this.trustedDeviceRepo.deleteAllByUserId(userId, tx);
    });
  }

  async regenerateBackupCodes(userId: number, code: string): Promise<ITwoFactorBackupCodes> {
    const user = await this.userRepo.findTwoFactorSetupInfo(userId);

    if (!user?.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException(TWO_FA_NOT_ENABLED);
    }

    const isValid = this.verifyTotpCode(user.twoFactorSecret, code);
    if (!isValid) {
      throw new UnauthorizedException(INVALID_CODE);
    }

    const plainCodes = this.generatePlainBackupCodes();
    const hashes = await Promise.all(plainCodes.map((c) => this.passwordService.hash(c)));

    await this.db.$transaction(async (tx) => {
      await this.backupCodeRepo.deleteAllByUserId(userId, tx);
      await this.backupCodeRepo.createMany(userId, hashes, tx);
    });

    return { backupCodes: plainCodes };
  }

  async getStatus(userId: number): Promise<ITwoFactorStatus> {
    const user = await this.userRepo.findTwoFactorStatus(userId);

    const backupCodesRemaining = user?.isTwoFactorEnabled
      ? await this.backupCodeRepo.countUnusedByUserId(userId)
      : 0;

    return {
      isEnabled: user?.isTwoFactorEnabled ?? false,
      confirmedAt: user?.twoFactorConfirmedAt?.toISOString() ?? null,
      backupCodesRemaining,
      isEnforced: user?.isTwoFactorEnforced ?? false,
      gracePeriodEnd: user?.twoFactorGracePeriodEnd?.toISOString() ?? null,
    };
  }

  /**
   * Records a failed 2FA attempt. Resets the counter when a previous lockout
   * has expired so users get a fresh set of attempts after waiting.
   */
  async checkAndRecordFailedAttempt(userId: number): Promise<void> {
    const maxAttempts =
      this.config.get<number>('app.twoFactor.maxAttempts') ?? DEFAULT_TWO_FACTOR_MAX_ATTEMPTS;
    const lockoutMs =
      this.config.get<number>('app.twoFactor.lockoutMs') ?? DEFAULT_TWO_FACTOR_LOCKOUT_MS;

    const updated = await this.db.$transaction(async (tx) => {
      const user = await this.userRepo.findTwoFactorAttemptInfo(userId, tx);

      const hadExpiredLockout =
        user.twoFactorAttemptsLockout !== null && user.twoFactorAttemptsLockout <= new Date();

      return this.userRepo.recordTwoFactorFailedAttempt(
        userId,
        {
          twoFactorAttempts: hadExpiredLockout ? 1 : { increment: 1 },
          twoFactorAttemptsLockout: null,
        },
        tx,
      );
    });

    if (updated.twoFactorAttempts >= maxAttempts) {
      await this.userRepo.setTwoFactorLockout(userId, new Date(Date.now() + lockoutMs));
    }
  }

  async checkLockout(userId: number): Promise<void> {
    const user = await this.userRepo.findTwoFactorLockout(userId);

    if (user?.twoFactorAttemptsLockout && user.twoFactorAttemptsLockout > new Date()) {
      throw new UnauthorizedException(
        'Too many failed verification attempts. Please try again later.',
      );
    }
  }

  async clearAttempts(userId: number): Promise<void> {
    await this.userRepo.clearTwoFactorAttempts(userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin operations
  // ──────────────────────────────────────────────────────────────────────────

  async adminDisable(targetUserId: number): Promise<void> {
    const user = await this.userRepo.findTwoFactorInfo(targetUserId);

    if (!user?.isTwoFactorEnabled && !user?.isTwoFactorEnforced) {
      throw new BadRequestException('Two-factor authentication is not active for this user');
    }

    await this.db.$transaction(async (tx) => {
      await this.userRepo.adminDisableTwoFactor(targetUserId, tx);
      await this.backupCodeRepo.deleteAllByUserId(targetUserId, tx as never);
      await this.trustedDeviceRepo.deleteAllByUserId(targetUserId, tx as never);
    });
  }

  async adminReset(targetUserId: number, clearRecoveryToken = false): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await this.userRepo.adminDisableTwoFactor(targetUserId, tx);
      await this.backupCodeRepo.deleteAllByUserId(targetUserId, tx as never);
      await this.trustedDeviceRepo.deleteAllByUserId(targetUserId, tx as never);
      await this.sessionRepo.deleteAllByUserId(targetUserId, tx as never);
      if (clearRecoveryToken) {
        await this.userRepo.clearTwoFactorRecoveryToken(targetUserId, tx as never);
      }
    });

    await this.sessionCache.invalidateAllUserSessions(targetUserId);
  }

  async getStats(): Promise<ITwoFactorStats> {
    return this.userRepo.countTwoFactorStats();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private verifyTotpCode(encryptedSecret: string, code: string): boolean {
    const secret = this.encryptionService.decrypt(encryptedSecret);
    const totpIssuer =
      this.config.get<string>('app.twoFactor.totpIssuer') ?? DEFAULT_TWO_FACTOR_TOTP_ISSUER;
    const totpWindow =
      this.config.get<number>('app.twoFactor.totpWindow') ?? DEFAULT_TWO_FACTOR_TOTP_WINDOW;
    const totp = new OTPAuth.TOTP({
      issuer: totpIssuer,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token: code, window: totpWindow });
    return delta !== null;
  }

  private generatePlainBackupCodes(): string[] {
    const count =
      this.config.get<number>('app.twoFactor.backupCodeCount') ??
      DEFAULT_TWO_FACTOR_BACKUP_CODE_COUNT;

    return Array.from({ length: count }, () => {
      const bytes = randomBytes(8);
      const letters = Array.from({ length: 4 }, (_, i) => {
        const val = bytes.readUInt16BE(i * 2) % 26;
        return String.fromCharCode(65 + val);
      }).join('');
      const digits = ((bytes.readUInt16BE(4) % 10000) + 10000).toString().slice(1);
      return `${letters}-${digits}`;
    });
  }
}
