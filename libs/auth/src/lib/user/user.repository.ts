import {
  DatabaseService,
  InviteStatus,
  Prisma,
  PrismaClientKnownRequestError,
  type TxClient,
  User,
  UserStatus,
} from '@mediastar/database';
import { Injectable } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Use-case-specific projections — each query fetches only the columns it needs.
// ---------------------------------------------------------------------------

/** Fields required by the login flow (password check, lockout, JWT signing). */
export interface UserForLogin {
  id: number;
  email: string;
  passwordHash: string | null;
  status: UserStatus;
  isDeleted: boolean;
  loginAttempts: number;
  loginAttemptsLockout: Date | null;
  isTwoFactorEnabled: boolean;
  isTwoFactorEnforced: boolean;
  isCredentialEnabled: boolean;
  userRoles: { role: { id: number; name: string } }[];
}

/** Fields required by the forgot-password flow (cooldown check, reset email). */
export interface UserForPasswordReset {
  id: number;
  email: string;
  status: UserStatus;
  isCredentialEnabled: boolean;
  passwordResetRequestedAt: Date | null;
  invitation: { status: InviteStatus } | null;
}

/** Fields required by the self-service 2FA recovery flow (cooldown check, recovery email). */
export interface UserForTwoFactorRecovery {
  id: number;
  email: string;
  isTwoFactorEnabled: boolean;
  twoFactorRecoveryRequestedAt: Date | null;
}

/** Fields required by the change-password flow (password verification). */
export interface UserForChangePassword {
  id: number;
  passwordHash: string | null;
  previousPasswordHash: string | null;
}

/** Fields required by the role-hierarchy guard (role level comparison). */
export interface UserRoleInfo {
  userRoles: { role: { id: number; level: number } }[];
}

/** Fields returned by the general-purpose user+roles finders (profile/display). */
export interface UserForProfile {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  type: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  userRoles: {
    id: number;
    userId: number;
    roleId: number;
    role: { id: number; name: string; level: number };
  }[];
}

// Prisma select constants — kept in sync with the interfaces above.
const USER_WITH_ROLES_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  type: true,
  city: true,
  state: true,
  zip: true,
  status: true,
  lastLoginAt: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    select: {
      id: true,
      userId: true,
      roleId: true,
      role: { select: { id: true, name: true, level: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type UserWithRoles = Prisma.UserGetPayload<{ select: typeof USER_WITH_ROLES_SELECT }>;

const LOGIN_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  status: true,
  isDeleted: true,
  loginAttempts: true,
  loginAttemptsLockout: true,
  isTwoFactorEnabled: true,
  isTwoFactorEnforced: true,
  isCredentialEnabled: true,
  userRoles: { select: { role: { select: { id: true, name: true } } } },
} satisfies Prisma.UserSelect;

const PASSWORD_RESET_SELECT = {
  id: true,
  email: true,
  status: true,
  isCredentialEnabled: true,
  passwordResetRequestedAt: true,
  invitation: { select: { status: true } },
} satisfies Prisma.UserSelect;

const CHANGE_PASSWORD_SELECT = {
  id: true,
  passwordHash: true,
  previousPasswordHash: true,
} satisfies Prisma.UserSelect;

const ROLE_INFO_SELECT = {
  userRoles: { select: { role: { select: { id: true, level: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // General query methods
  // ──────────────────────────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { email },
      select: USER_WITH_ROLES_SELECT,
    });
  }

  async findById(id: number): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { id },
      select: USER_WITH_ROLES_SELECT,
    });
  }

  async findForLogin(email: string): Promise<UserForLogin | null> {
    // First try active users (soft-delete extension auto-filters isDeleted: false).
    // If not found, also check soft-deleted users so the login flow can return
    // "Contact Administrator" instead of the misleading "Invalid Credentials".
    const active = await this.db.user.findUnique({ where: { email }, select: LOGIN_SELECT });
    if (active) return active;

    return this.db.user.findFirst({
      where: { email, isDeleted: true },
      select: LOGIN_SELECT,
    });
  }

  async findForLoginById(id: number): Promise<UserForLogin | null> {
    return this.db.user.findUnique({ where: { id }, select: LOGIN_SELECT });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.db.user.count({ where: { email } });
    return count > 0;
  }

  async findExistingByEmail(
    email: string,
  ): Promise<{ status: UserStatus; isDeleted: boolean } | null> {
    const [existing, deleted] = await Promise.all([
      this.db.user.findUnique({ where: { email }, select: { status: true } }),
      this.db.user.findFirst({ where: { email, isDeleted: true }, select: { status: true } }),
    ]);

    if (existing) return { status: existing.status, isDeleted: false };
    if (deleted) return { status: deleted.status, isDeleted: true };
    return null;
  }

  async findForPasswordReset(email: string): Promise<UserForPasswordReset | null> {
    return this.db.user.findUnique({ where: { email }, select: PASSWORD_RESET_SELECT });
  }

  async findForTwoFactorRecovery(userId: number): Promise<UserForTwoFactorRecovery | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isTwoFactorEnabled: true,
        twoFactorRecoveryRequestedAt: true,
      },
    });
  }

  async findPasswordHash(id: number): Promise<UserForChangePassword | null> {
    return this.db.user.findUnique({ where: { id }, select: CHANGE_PASSWORD_SELECT });
  }

  async findTwoFactorInfo(
    id: number,
  ): Promise<Pick<User, 'isTwoFactorEnabled' | 'isTwoFactorEnforced'> | null> {
    return this.db.user.findUnique({
      where: { id },
      select: { isTwoFactorEnabled: true, isTwoFactorEnforced: true },
    });
  }

  async findRoleInfo(id: number): Promise<UserRoleInfo | null> {
    return this.db.user.findUnique({ where: { id }, select: ROLE_INFO_SELECT });
  }

  async findBySetPasswordToken(
    tokenHash: string,
  ): Promise<Pick<
    User,
    'id' | 'passwordHash' | 'previousPasswordHash' | 'setPasswordRequestedAt'
  > | null> {
    return this.db.user.findFirst({
      where: { setPasswordToken: tokenHash },
      select: {
        id: true,
        passwordHash: true,
        previousPasswordHash: true,
        setPasswordRequestedAt: true,
      },
    });
  }

  async findByResetToken(
    resetTokenHash: string,
  ): Promise<Pick<
    User,
    'id' | 'passwordHash' | 'previousPasswordHash' | 'passwordResetRequestedAt' | 'status'
  > | null> {
    return this.db.user.findFirst({
      where: { resetToken: resetTokenHash },
      select: {
        id: true,
        status: true,
        passwordHash: true,
        previousPasswordHash: true,
        passwordResetRequestedAt: true,
      },
    });
  }

  async findDefaultRoleId(roleName: string): Promise<{ id: number } | null> {
    return this.db.role.findFirst({ where: { name: roleName } });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Global 2FA enforcement (reads AppSetting directly — auth lib has no AdminSettingsService)
  // ──────────────────────────────────────────────────────────────────────────

  async getGlobal2faEnforcement(): Promise<{
    isTwoFactorEnforced: boolean;
    twoFactorGracePeriodEnd: Date | undefined;
  }> {
    // AppSetting model removed; no global enforcement source available.
    return { isTwoFactorEnforced: false, twoFactorGracePeriodEnd: undefined };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Write methods
  // ──────────────────────────────────────────────────────────────────────────

  async create(data: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<User | undefined> {
    try {
      const twoFa = await this.getGlobal2faEnforcement();
      return await this.db.user.create({
        data: {
          email: data.email,
          passwordHash: null,
          firstName: data.firstName,
          lastName: data.lastName,
          ...(twoFa.isTwoFactorEnforced && {
            isTwoFactorEnforced: true,
            twoFactorGracePeriodEnd: twoFa.twoFactorGracePeriodEnd,
          }),
        },
      });
    } catch (err: unknown) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        return undefined;
      }
      throw err;
    }
  }

  async setResetToken(userId: number, resetTokenHash: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        resetToken: resetTokenHash,
        passwordResetRequestedAt: new Date(),
      },
    });
  }

  async setTwoFactorRecoveryToken(userId: number, tokenHash: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        twoFactorRecoveryToken: tokenHash,
        twoFactorRecoveryRequestedAt: new Date(),
      },
    });
  }

  async findByTwoFactorRecoveryToken(
    tokenHash: string,
  ): Promise<Pick<
    User,
    'id' | 'email' | 'isTwoFactorEnabled' | 'twoFactorRecoveryRequestedAt'
  > | null> {
    return this.db.user.findUnique({
      where: { twoFactorRecoveryToken: tokenHash },
      select: {
        id: true,
        email: true,
        isTwoFactorEnabled: true,
        twoFactorRecoveryRequestedAt: true,
      },
    });
  }

  async clearTwoFactorRecoveryToken(userId: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId },
      data: {
        twoFactorRecoveryToken: null,
        twoFactorRecoveryRequestedAt: null,
      },
    });
  }

  async clearLoginAttempts(userId: number): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { loginAttempts: 0, loginAttemptsLockout: null, lastLoginAt: new Date() },
    });
  }

  async recordFailedAttempt(
    userId: number,
    data: { loginAttempts: number; loginAttemptsLockout?: Date },
  ): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        loginAttempts: data.loginAttempts,
        ...(data.loginAttemptsLockout != null && {
          loginAttemptsLockout: data.loginAttemptsLockout,
        }),
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Transaction-aware write methods
  // ──────────────────────────────────────────────────────────────────────────

  async updatePasswordAndClearToken(
    userId: number,
    passwordHash: string,
    tx?: TxClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        setPasswordToken: null,
        setPasswordRequestedAt: null,
        previousPasswordHash: null,
      },
    });
  }

  async updatePasswordWithRotation(
    userId: number,
    newPasswordHash: string,
    clearResetToken: boolean,
    tx?: TxClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    const user = await client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    await client.user.update({
      where: { id: userId },
      data: {
        previousPasswordHash: user.passwordHash,
        passwordHash: newPasswordHash,
        ...(clearResetToken && {
          resetToken: null,
          passwordResetRequestedAt: null,
        }),
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Two-factor authentication methods
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Acquires an exclusive row lock on the user via SELECT ... FOR UPDATE.
   * Must be called inside a transaction to serialise concurrent 2FA
   * verify / disable operations for the same user.
   */
  async lockUserForTwoFactor(
    userId: number,
    tx: TxClient,
  ): Promise<{
    isTwoFactorEnabled: boolean;
    isTwoFactorEnforced: boolean;
    twoFactorSecret: string | null;
  }> {
    const rows = await (tx as never as DatabaseService).$queryRaw<
      {
        is_two_factor_enabled: boolean;
        is_two_factor_enforced: boolean;
        two_factor_secret: string | null;
      }[]
    >`SELECT is_two_factor_enabled, is_two_factor_enforced, two_factor_secret FROM users WHERE id = ${userId} FOR UPDATE`;

    if (rows.length === 0) {
      return { isTwoFactorEnabled: false, isTwoFactorEnforced: false, twoFactorSecret: null };
    }

    return {
      isTwoFactorEnabled: rows[0].is_two_factor_enabled,
      isTwoFactorEnforced: rows[0].is_two_factor_enforced,
      twoFactorSecret: rows[0].two_factor_secret,
    };
  }

  async findTwoFactorSecret(userId: number): Promise<{ twoFactorSecret: string | null } | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });
  }

  async findTwoFactorSetupInfo(
    userId: number,
  ): Promise<{ isTwoFactorEnabled: boolean; twoFactorSecret: string | null } | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { isTwoFactorEnabled: true, twoFactorSecret: true },
    });
  }

  async findTwoFactorStatus(userId: number): Promise<{
    isTwoFactorEnabled: boolean;
    isTwoFactorEnforced: boolean;
    twoFactorConfirmedAt: Date | null;
    twoFactorGracePeriodEnd: Date | null;
  } | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        isTwoFactorEnabled: true,
        isTwoFactorEnforced: true,
        twoFactorConfirmedAt: true,
        twoFactorGracePeriodEnd: true,
      },
    });
  }

  async findTwoFactorLockout(
    userId: number,
  ): Promise<{ twoFactorAttemptsLockout: Date | null } | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { twoFactorAttemptsLockout: true },
    });
  }

  async findTwoFactorAttemptInfo(
    userId: number,
    tx?: TxClient,
  ): Promise<{ twoFactorAttempts: number; twoFactorAttemptsLockout: Date | null }> {
    const client = tx ?? this.db;
    return client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorAttempts: true, twoFactorAttemptsLockout: true },
    });
  }

  async updateTwoFactorSecret(
    userId: number,
    data: {
      twoFactorSecret: string;
      twoFactorConfirmedAt: null;
      isTwoFactorEnabled: false;
    },
  ): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data,
    });
  }

  async enableTwoFactor(userId: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: true,
        twoFactorConfirmedAt: new Date(),
        twoFactorAttempts: 0,
        twoFactorAttemptsLockout: null,
        twoFactorGracePeriodEnd: null,
      },
    });
  }

  async disableTwoFactor(userId: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorConfirmedAt: null,
        twoFactorAttempts: 0,
        twoFactorAttemptsLockout: null,
        twoFactorGracePeriodEnd: null,
      },
    });
  }

  async adminDisableTwoFactor(userId: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        isTwoFactorEnforced: false,
        twoFactorSecret: null,
        twoFactorConfirmedAt: null,
        twoFactorAttempts: 0,
        twoFactorAttemptsLockout: null,
        twoFactorGracePeriodEnd: null,
      },
    });
  }

  async recordTwoFactorFailedAttempt(
    userId: number,
    data: {
      twoFactorAttempts: number | { increment: 1 };
      twoFactorAttemptsLockout: null;
    },
    tx?: TxClient,
  ): Promise<{ twoFactorAttempts: number }> {
    const client = tx ?? this.db;
    return client.user.update({
      where: { id: userId },
      data,
      select: { twoFactorAttempts: true },
    });
  }

  async setTwoFactorLockout(userId: number, lockoutUntil: Date): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { twoFactorAttemptsLockout: lockoutUntil },
    });
  }

  async clearTwoFactorAttempts(userId: number): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { twoFactorAttempts: 0, twoFactorAttemptsLockout: null },
    });
  }

  async countTwoFactorStats(): Promise<{
    totalUsers: number;
    enabledCount: number;
    enforcedCount: number;
    gracePeriodCount: number;
    expiredGraceCount: number;
  }> {
    const now = new Date();

    const [totalUsers, enabledCount, enforcedCount, gracePeriodCount, expiredGraceCount] =
      await Promise.all([
        this.db.user.count({
          where: { status: 'ACTIVE', isDeleted: false },
        }),
        this.db.user.count({
          where: { status: 'ACTIVE', isDeleted: false, isTwoFactorEnabled: true },
        }),
        this.db.user.count({
          where: { status: 'ACTIVE', isDeleted: false, isTwoFactorEnforced: true },
        }),
        this.db.user.count({
          where: {
            status: 'ACTIVE',
            isDeleted: false,
            isTwoFactorEnabled: false,
            twoFactorGracePeriodEnd: { gt: now },
          },
        }),
        this.db.user.count({
          where: {
            status: 'ACTIVE',
            isDeleted: false,
            isTwoFactorEnabled: false,
            twoFactorGracePeriodEnd: { lte: now },
          },
        }),
      ]);

    return { totalUsers, enabledCount, enforcedCount, gracePeriodCount, expiredGraceCount };
  }
}
