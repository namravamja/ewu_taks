import { AppLoggerService, BuiltInRole } from '@mediastar/core';
import { DatabaseService, User, UserStatus } from '@mediastar/database';
import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';

import { LOCKOUT_DURATION_MS, MAX_LOCKOUT_DURATION_MS, MAX_LOGIN_ATTEMPTS } from '../constants';
import { SessionRepository } from '../session/session.repository';
import type {
  UserForChangePassword,
  UserForLogin,
  UserForPasswordReset,
  UserForTwoFactorRecovery,
  UserRoleInfo,
  UserWithRoles,
} from '../user/user.repository';
import { UserRepository } from '../user/user.repository';

export type {
  UserForChangePassword,
  UserForLogin,
  UserForPasswordReset,
  UserForTwoFactorRecovery,
} from '../user/user.repository';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    private readonly db: DatabaseService,
    private readonly sessionRepo: SessionRepository,
    private readonly logger: AppLoggerService,
    private readonly userRepo: UserRepository,
  ) {
    this.logger.setContext(UserService.name);
  }

  async onModuleInit(): Promise<void> {
    const defaultRole = await this.userRepo.findDefaultRoleId(BuiltInRole.User);
    if (!defaultRole) {
      this.logger.error(
        `Required "${BuiltInRole.User}" role not found in database. ` +
          'Seed data has not been applied. ' +
          'Run: pnpm db:seed',
      );
      throw new InternalServerErrorException('Default role not configured');
    }
  }

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.userRepo.findByEmail(email);
  }

  async findById(id: number): Promise<UserWithRoles | null> {
    return this.userRepo.findById(id);
  }

  /** Login flow — fetches only auth-relevant columns + role name (by email). */
  async findForLogin(email: string): Promise<UserForLogin | null> {
    return this.userRepo.findForLogin(email);
  }

  /** Login flow — fetches only auth-relevant columns + role name (by id). */
  async findForLoginById(id: number): Promise<UserForLogin | null> {
    return this.userRepo.findForLoginById(id);
  }

  /** Register flow — checks whether an email is already taken without loading any data. */
  async existsByEmail(email: string): Promise<boolean> {
    return this.userRepo.existsByEmail(email);
  }

  /**
   * Checks whether an email already exists in any state (active, soft-deleted, etc.).
   * Returns the user's status and deletion flag so the caller can send a status-aware email.
   */
  async findExistingByEmail(
    email: string,
  ): Promise<{ status: UserStatus; isDeleted: boolean } | null> {
    return this.userRepo.findExistingByEmail(email);
  }

  /** Forgot-password flow — fetches only fields needed for cooldown check and reset email. */
  async findForPasswordReset(email: string): Promise<UserForPasswordReset | null> {
    return this.userRepo.findForPasswordReset(email);
  }

  /** Change-password flow — fetches only the password hash for verification. */
  async findPasswordHash(id: number): Promise<UserForChangePassword | null> {
    return this.userRepo.findPasswordHash(id);
  }

  /** Fetches 2FA-related fields for a user (used after set-password to check enforcement). */
  async findTwoFactorInfo(
    id: number,
  ): Promise<Pick<User, 'isTwoFactorEnabled' | 'isTwoFactorEnforced'> | null> {
    return this.userRepo.findTwoFactorInfo(id);
  }

  /** Role-hierarchy guard — fetches only roleId and role level for authorization checks. */
  async findRoleInfo(id: number): Promise<UserRoleInfo | null> {
    return this.userRepo.findRoleInfo(id);
  }

  /** Finds a user by their stored set-password-token hash. Used in the set-password flow. */
  async findBySetPasswordToken(
    tokenHash: string,
  ): Promise<Pick<
    User,
    'id' | 'passwordHash' | 'previousPasswordHash' | 'setPasswordRequestedAt'
  > | null> {
    return this.userRepo.findBySetPasswordToken(tokenHash);
  }

  /** Updates password and clears set-password token fields and previous password hash. */
  async setPasswordAndClearToken(userId: number, passwordHash: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await this.userRepo.updatePasswordAndClearToken(userId, passwordHash, tx);
      await this.sessionRepo.deleteAllByUserId(userId, tx);
    });
  }

  /** Finds a user by their stored reset-token hash. Used in the reset-password flow. */
  async findByResetToken(
    resetTokenHash: string,
  ): Promise<Pick<
    User,
    'id' | 'passwordHash' | 'previousPasswordHash' | 'passwordResetRequestedAt' | 'status'
  > | null> {
    return this.userRepo.findByResetToken(resetTokenHash);
  }

  /**
   * Creates a new user in PENDING status (no role assigned — role is set at approval).
   * Returns `undefined` on duplicate-email race condition (P2002) so the caller
   * can return a generic response without leaking whether the email exists.
   */
  async create(data: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<User | undefined> {
    return this.userRepo.create(data);
  }

  /**
   * Stores sha256(rawToken) and records when the reset was requested.
   * The raw token is sent in the reset link — only the hash is stored.
   */
  async setResetToken(userId: number, resetTokenHash: string): Promise<void> {
    return this.userRepo.setResetToken(userId, resetTokenHash);
  }

  async findForTwoFactorRecovery(userId: number): Promise<UserForTwoFactorRecovery | null> {
    return this.userRepo.findForTwoFactorRecovery(userId);
  }

  async setTwoFactorRecoveryToken(userId: number, tokenHash: string): Promise<void> {
    return this.userRepo.setTwoFactorRecoveryToken(userId, tokenHash);
  }

  async findByTwoFactorRecoveryToken(
    tokenHash: string,
  ): Promise<Pick<
    User,
    'id' | 'email' | 'isTwoFactorEnabled' | 'twoFactorRecoveryRequestedAt'
  > | null> {
    return this.userRepo.findByTwoFactorRecoveryToken(tokenHash);
  }

  async clearTwoFactorRecoveryToken(userId: number): Promise<void> {
    return this.userRepo.clearTwoFactorRecoveryToken(userId);
  }

  /** Resets login attempts and records the login timestamp after a successful login. */
  async clearLoginAttempts(userId: number): Promise<void> {
    return this.userRepo.clearLoginAttempts(userId);
  }

  /**
   * Records a failed login attempt for a user. Uses progressive lockout:
   * the first lockout lasts {@link LOCKOUT_DURATION_MS}, and each subsequent
   * lockout doubles the duration up to {@link MAX_LOCKOUT_DURATION_MS}.
   *
   * The cumulative `loginAttempts` counter is NOT reset when the lockout
   * window expires — it only resets on a successful login via
   * {@link clearLoginAttempts}. This means repeated lockouts escalate.
   */
  async recordFailedAttempt(
    user: Pick<UserForLogin, 'id' | 'loginAttempts' | 'loginAttemptsLockout'>,
  ): Promise<void> {
    const newAttempts = user.loginAttempts + 1;
    const isNowLocked = newAttempts % MAX_LOGIN_ATTEMPTS === 0;

    let lockoutDuration: number | undefined;
    if (isNowLocked) {
      const lockoutCount = Math.floor(newAttempts / MAX_LOGIN_ATTEMPTS);
      lockoutDuration = Math.min(
        LOCKOUT_DURATION_MS * Math.pow(2, lockoutCount - 1),
        MAX_LOCKOUT_DURATION_MS,
      );
    }

    await this.userRepo.recordFailedAttempt(user.id, {
      loginAttempts: newAttempts,
      ...(lockoutDuration != null && {
        loginAttemptsLockout: new Date(Date.now() + lockoutDuration),
      }),
    });
  }

  /**
   * Atomically updates the password (rotating the previous hash), clears the
   * reset token, and revokes all sessions. Used by the reset-password flow.
   */
  async updatePasswordAndRevokeSessions(userId: number, passwordHash: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await this.userRepo.updatePasswordWithRotation(userId, passwordHash, true, tx);
      await this.sessionRepo.deleteAllByUserId(userId, tx);
    });
  }

  /**
   * Atomically updates the password (rotating the previous hash) and revokes
   * all sessions except the current one. Used by the change-password flow.
   */
  async updatePasswordAndRevokeOtherSessions(
    userId: number,
    passwordHash: string,
    keepSessionId: number,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await this.userRepo.updatePasswordWithRotation(userId, passwordHash, false, tx);
      await this.sessionRepo.deleteAllByUserIdExcept(userId, keepSessionId, tx);
    });
  }
}
