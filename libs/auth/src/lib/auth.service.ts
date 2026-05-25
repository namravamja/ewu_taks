import {
  AppLoggerService,
  CacheService,
  type GeoLocationResult,
  parseDurationMs,
} from '@mediastar/core';
import { DatabaseService, InviteStatus, UserStatus } from '@mediastar/database';
import { PasswordService } from '@mediastar/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthErrorCode, createAuthError, getAuthErrorMessage } from './auth-error-code.enum';
import {
  DEFAULT_TWO_FACTOR_TOKEN_EXPIRY,
  FALLBACK_REFRESH_MS,
  MAX_CONCURRENT_SESSIONS,
  RESET_COOLDOWN_MS,
  RESET_TOKEN_TTL_MS,
  SESSION_LIMIT_LOCK_PREFIX,
  SESSION_LIMIT_LOCK_TTL_SECONDS,
  SESSION_MGMT_CONSUMED_PREFIX,
  SESSION_MGMT_TOKEN_EXPIRY,
  SET_PASSWORD_TOKEN_TTL_MS,
  TWO_FACTOR_CONSUMED_PREFIX,
  TWO_FACTOR_RECOVERY_COOLDOWN_MS,
  TWO_FACTOR_RECOVERY_TOKEN_TTL_MS,
} from './constants';
import { AuthTokenVM } from './dtos/auth-token.vm';
import { ChangePasswordDTO } from './dtos/change-password.dto';
import { ForgotPasswordDTO } from './dtos/forgot-password.dto';
import { LoginDTO } from './dtos/login.dto';
import type { SessionInfoVM } from './dtos/max-sessions.vm';
import { RegisterDTO } from './dtos/register.dto';
import { ResetPasswordDTO } from './dtos/reset-password.dto';
import type { ResolveSessionConflictDTO } from './dtos/resolve-session-conflict.dto';
import { SetPasswordDTO } from './dtos/set-password.dto';
import type { IRefreshTokenPayload } from './jwt/jwt-payload.interface';
import { TokenService } from './jwt/token.service';
import { CaptchaService } from './services/captcha.service';
import { UserService } from './services/user.service';
import type { SessionListItem, SessionWithUser } from './session/session.repository';
import { SessionRepository } from './session/session.repository';
import { SessionCacheService } from './session/session-cache.service';
import type { ISessionMetadata } from './session/session-metadata.interface';
import { TrustedDeviceService } from './two-factor/trusted-device.service';
import type { ITwoFactorBackupCodes } from './two-factor/two-factor.interface';
import { TwoFactorService } from './two-factor/two-factor.service';
import { UserForLogin } from './user/user.repository';
import { parseUserAgent } from './utils/parse-user-agent.util';

const CREDENTIAL_REUSE_MSG = 'New password must differ from current password';
const PREVIOUS_CREDENTIAL_REUSE_MSG = 'New password must differ from your previous password';

/** Shape returned by every flow that creates a login session (login, 2FA, SSO, conflict resolution). */
export interface AuthSessionResult {
  vm: AuthTokenVM;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshMs: number;
}

interface LoginSuccess extends AuthSessionResult {
  requiresTwoFactor: false;
}

interface LoginRequires2FA {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: number;
}

export type LoginResult = LoginSuccess | LoginRequires2FA;

export type TwoFactorVerifyResult = AuthSessionResult & {
  trustToken?: string;
  trustExpiresAt?: Date;
};

export type SessionConflictResult = AuthSessionResult & {
  trustToken?: string;
  trustExpiresAt?: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly config: ConfigService,
    private readonly sessionRepo: SessionRepository,
    private readonly sessionCache: SessionCacheService,
    private readonly twoFactorService: TwoFactorService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly cache: CacheService,
    private readonly logger: AppLoggerService,
    private readonly captchaService: CaptchaService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(
    dto: LoginDTO,
    meta: ISessionMetadata,
    trustedDeviceCookie?: string,
  ): Promise<LoginResult> {
    const user = await this.validateLoginCredentials(dto);

    if (user.isTwoFactorEnabled) {
      // Check trusted device — skip 2FA if valid
      if (trustedDeviceCookie) {
        const isTrusted = await this.trustedDeviceService.validateTrustToken(
          trustedDeviceCookie,
          user.id,
          { ipAddress: meta.ipAddress, userAgent: meta.userAgent },
        );
        if (isTrusted) {
          await this.enforceSessionLimit(user.id, {
            trustDevice: false,
            ipAddress: meta.ipAddress,
          });
          const session = await this.createLoginSession(user, meta);
          return { requiresTwoFactor: false, ...session };
        }
      }

      // Session limit is NOT checked here — it will be enforced in verifyTwoFactor()
      // after the user completes 2FA. Checking before 2FA would leak session metadata
      // (IPs, user agents) to anyone with only valid credentials.
      const twoFactorTokenExpiry =
        this.config.get<string>('app.twoFactor.tokenExpiry') ?? DEFAULT_TWO_FACTOR_TOKEN_EXPIRY;
      const twoFactorToken = this.tokenService.signTwoFactorToken(
        { sub: String(user.id), sessionId: 'pending' },
        twoFactorTokenExpiry,
      );

      return {
        requiresTwoFactor: true,
        twoFactorToken,
        expiresIn: Math.floor(parseDurationMs(twoFactorTokenExpiry) / 1000),
      };
    }

    await this.enforceSessionLimit(user.id, {
      trustDevice: false,
      ipAddress: meta.ipAddress,
    });
    const session = await this.createLoginSession(user, meta);
    return { requiresTwoFactor: false, ...session };
  }

  async verifyTwoFactor(
    twoFactorToken: string,
    code: string,
    meta: ISessionMetadata,
    trustDevice: boolean,
  ): Promise<TwoFactorVerifyResult> {
    const payload = this.tokenService.verifyTwoFactorToken(twoFactorToken);
    const userId = Number(payload.sub);

    await this.twoFactorService.checkLockout(userId);

    // Claim the 2FA token before verifying the code so concurrent requests
    // using the same token can't each consume a backup code. On verification
    // failure we release the claim so the user can retry with a corrected code.
    const tokenHash = this.tokenService.hashToken(twoFactorToken);
    const twoFactorTokenExpiry =
      this.config.get<string>('app.twoFactor.tokenExpiry') ?? DEFAULT_TWO_FACTOR_TOKEN_EXPIRY;
    const ttlSeconds = Math.ceil(parseDurationMs(twoFactorTokenExpiry) / 1000);
    const consumedKey = `${TWO_FACTOR_CONSUMED_PREFIX}:${tokenHash}`;
    const isFirstUse = await this.cache.setIfAbsentStrict(consumedKey, true, ttlSeconds);

    if (!isFirstUse) {
      throw new UnauthorizedException('Two-factor token has already been used');
    }

    // Determine if this is a TOTP code (6 digits) or backup code
    const isTotpCode = /^\d{6}$/.test(code);
    let isValid: boolean;

    try {
      isValid = isTotpCode
        ? await this.twoFactorService.verifyCode(userId, code)
        : await this.twoFactorService.verifyBackupCode(userId, code);
    } catch (err) {
      await this.cache.delete(consumedKey);
      throw err;
    }

    if (!isValid) {
      await this.cache.delete(consumedKey);
      await this.twoFactorService.checkAndRecordFailedAttempt(userId);
      throw new UnauthorizedException('Invalid verification code');
    }

    // Clear attempts on success
    this.twoFactorService.clearAttempts(userId).catch((error: unknown) => {
      this.logger.warn(`Failed to clear 2FA attempts for user ${userId}: ${error}`);
    });

    // Load user for login session creation and re-validate status
    // (account may have been suspended during the 2FA window)
    const user = await this.userService.findForLoginById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(AuthErrorCode.CONTACT_ADMINISTRATOR);
    }

    // Re-check session limit — another session may have been created during the 2FA window
    await this.enforceSessionLimit(user.id, { trustDevice, ipAddress: meta.ipAddress });

    const session = await this.createLoginSession(user, meta);

    // Optionally create trust token
    let trustToken: string | undefined;
    let trustExpiresAt: Date | undefined;

    if (trustDevice) {
      const trust = await this.trustedDeviceService.createTrustToken(userId, {
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      trustToken = trust.rawToken;
      trustExpiresAt = trust.expiresAt;
    }

    return { ...session, trustToken, trustExpiresAt };
  }

  async refresh(
    rawToken: string | undefined,
    meta: ISessionMetadata,
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    remainingMs: number;
  }> {
    const { payload, sessionId, userId, token } = this.validateRefreshPayload(rawToken);
    const session = await this.verifySessionIntegrity(sessionId, userId, token);
    return this.rotateTokens(session, payload, meta);
  }

  async logout(userId: number, sessionId: number): Promise<{ message: string }> {
    await this.sessionRepo.delete(sessionId);
    await this.sessionCache.invalidateSession(userId, sessionId);
    return { message: 'Logged out successfully' };
  }

  private static readonly REGISTRATION_GENERIC_MSG =
    'If this email is eligible, you will receive a confirmation email shortly.';

  async register(dto: RegisterDTO, ip?: string): Promise<{ message: string }> {
    const { email, firstName, lastName, captchaToken } = dto;

    // CAPTCHA verification — bypass is controlled server-side by NODE_ENV only.
    await this.captchaService.verify(captchaToken, ip);

    // Check existing user (returns status + deletion flag for status-aware email)
    const existing = await this.userService.findExistingByEmail(email);

    if (existing) {
      // Future: notify existing/deleted account (email subsystem removed)
      return { message: AuthService.REGISTRATION_GENERIC_MSG };
    }

    // Create new user (PENDING, no verification token)
    const user = await this.userService.create({ email, firstName, lastName });

    // P2002 race condition — create returned undefined → still return generic success
    if (!user) {
      return { message: AuthService.REGISTRATION_GENERIC_MSG };
    }

    // Send "registration received" email
    // Future: send registration-received email (email subsystem removed)

    return { message: AuthService.REGISTRATION_GENERIC_MSG };
  }

  async forgotPassword(dto: ForgotPasswordDTO): Promise<{ message: string }> {
    const user = await this.userService.findForPasswordReset(dto.email);

    if (user) {
      if (user.status === UserStatus.SUSPENDED) {
        throw createAuthError(AuthErrorCode.SUSPENDED);
      }

      if (
        user.invitation?.status === InviteStatus.PENDING ||
        user.invitation?.status === InviteStatus.REVOKED
      ) {
        throw createAuthError(AuthErrorCode.INVITED);
      }

      if (!user.isCredentialEnabled) {
        throw createAuthError(AuthErrorCode.CREDENTIALS_DISABLED);
      }

      const lastRequest = user.passwordResetRequestedAt;
      if (lastRequest && Date.now() - lastRequest.getTime() < RESET_COOLDOWN_MS) {
        // Still within cooldown — return the generic message without issuing a new token
        return { message: 'If this email exists, a reset link was sent' };
      }

      const rawToken = this.tokenService.generateSecureToken();
      const resetTokenHash = this.tokenService.hashToken(rawToken);

      await this.userService.setResetToken(user.id, resetTokenHash);

      // Future: send password-reset email (email subsystem removed)
    }

    // Always return the same message — prevent user enumeration
    return { message: 'If this email exists, a reset link was sent' };
  }

  async validateResetToken(token: string): Promise<{ message: string }> {
    const invalidLinkError = new UnauthorizedException('Invalid or expired reset link');

    const tokenHash = this.tokenService.hashToken(token);
    const user = await this.userService.findByResetToken(tokenHash);

    if (!user) throw invalidLinkError;

    const requestedAt = user.passwordResetRequestedAt;
    if (!requestedAt || Date.now() - requestedAt.getTime() > RESET_TOKEN_TTL_MS) {
      throw invalidLinkError;
    }

    return { message: 'Token is valid' };
  }

  async validateSetPasswordToken(token: string): Promise<{ message: string }> {
    const invalidLinkError = new UnauthorizedException('Invalid or expired set-password link');

    const tokenHash = this.tokenService.hashToken(token);
    const user = await this.userService.findBySetPasswordToken(tokenHash);

    if (!user) throw invalidLinkError;

    const requestedAt = user.setPasswordRequestedAt;
    if (!requestedAt || Date.now() - requestedAt.getTime() > SET_PASSWORD_TOKEN_TTL_MS) {
      throw invalidLinkError;
    }

    return { message: 'Token is valid' };
  }

  async resetPassword(dto: ResetPasswordDTO): Promise<{ message: string }> {
    const invalidLinkError = new UnauthorizedException('Invalid or expired reset link');

    const tokenHash = this.tokenService.hashToken(dto.token);
    const user = await this.userService.findByResetToken(tokenHash);

    if (!user) throw invalidLinkError;

    if (user.status === UserStatus.SUSPENDED) {
      throw invalidLinkError;
    }

    // Check expiry
    const requestedAt = user.passwordResetRequestedAt;
    if (!requestedAt || Date.now() - requestedAt.getTime() > RESET_TOKEN_TTL_MS) {
      throw invalidLinkError;
    }

    const sameAsCurrentPassword =
      user.passwordHash && (await this.passwordService.compare(dto.newPassword, user.passwordHash));

    if (sameAsCurrentPassword) {
      throw new BadRequestException(CREDENTIAL_REUSE_MSG);
    }

    // Check previous password
    if (
      user.previousPasswordHash &&
      (await this.passwordService.compare(dto.newPassword, user.previousPasswordHash))
    ) {
      throw new BadRequestException(PREVIOUS_CREDENTIAL_REUSE_MSG);
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.userService.updatePasswordAndRevokeSessions(user.id, newPasswordHash);
    await this.sessionCache.invalidateAllUserSessions(user.id);

    return { message: 'Password reset successfully. Please log in again.' };
  }

  async requestTwoFactorRecovery(twoFactorToken: string): Promise<{ message: string }> {
    const invalidTokenError = new UnauthorizedException('Invalid or expired two-factor token');
    const genericMessage = 'If your account exists, a recovery link has been sent to your email';

    let userId: number;
    try {
      const payload = this.tokenService.verifyTwoFactorToken(twoFactorToken);
      userId = parseInt(payload.sub, 10);
    } catch {
      throw invalidTokenError;
    }

    const user = await this.userService.findForTwoFactorRecovery(userId);
    if (!user || !user.isTwoFactorEnabled) return { message: genericMessage };

    const lastRequest = user.twoFactorRecoveryRequestedAt;
    if (lastRequest && Date.now() - lastRequest.getTime() < TWO_FACTOR_RECOVERY_COOLDOWN_MS) {
      return { message: genericMessage };
    }

    const rawToken = this.tokenService.generateSecureToken();
    const tokenHash = this.tokenService.hashToken(rawToken);

    await this.userService.setTwoFactorRecoveryToken(userId, tokenHash);

    // Future: send two-factor-recovery email (email subsystem removed)

    return { message: genericMessage };
  }

  async confirmTwoFactorRecovery(rawToken: string): Promise<{ message: string }> {
    const invalidLinkError = new UnauthorizedException('Invalid or expired recovery link');

    const tokenHash = this.tokenService.hashToken(rawToken);
    const user = await this.userService.findByTwoFactorRecoveryToken(tokenHash);

    if (!user || !user.isTwoFactorEnabled) throw invalidLinkError;

    const requestedAt = user.twoFactorRecoveryRequestedAt;
    if (!requestedAt || Date.now() - requestedAt.getTime() > TWO_FACTOR_RECOVERY_TOKEN_TTL_MS) {
      throw invalidLinkError;
    }

    await this.twoFactorService.adminReset(user.id, true);

    return {
      message: 'Two-factor authentication has been reset. Please log in and set up 2FA again.',
    };
  }

  async setPasswordViaToken(
    dto: SetPasswordDTO,
  ): Promise<{ message: string; requiresTwoFactorSetup: boolean }> {
    const invalidLinkError = new UnauthorizedException('Invalid or expired set-password link');

    const tokenHash = this.tokenService.hashToken(dto.token);
    const user = await this.userService.findBySetPasswordToken(tokenHash);

    if (!user) throw invalidLinkError;

    const requestedAt = user.setPasswordRequestedAt;
    if (!requestedAt || Date.now() - requestedAt.getTime() > SET_PASSWORD_TOKEN_TTL_MS) {
      throw invalidLinkError;
    }

    // Prevent reuse of previous password
    if (
      user.previousPasswordHash &&
      (await this.passwordService.compare(dto.newPassword, user.previousPasswordHash))
    ) {
      throw new BadRequestException(PREVIOUS_CREDENTIAL_REUSE_MSG);
    }

    // Prevent setting the same password as current
    if (
      user.passwordHash &&
      (await this.passwordService.compare(dto.newPassword, user.passwordHash))
    ) {
      throw new BadRequestException(CREDENTIAL_REUSE_MSG);
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.userService.setPasswordAndClearToken(user.id, newPasswordHash);
    await this.sessionCache.invalidateAllUserSessions(user.id);

    // Check if the user needs to set up 2FA after setting their password
    const userData = await this.userService.findTwoFactorInfo(user.id);
    const requiresTwoFactorSetup =
      (userData?.isTwoFactorEnforced ?? false) && !(userData?.isTwoFactorEnabled ?? false);

    return { message: 'Password set successfully. Please log in.', requiresTwoFactorSetup };
  }

  /**
   * Resolves a session-limit conflict by terminating a chosen session and
   * completing the original login in a single step.
   *
   * The `sessionMgmtToken` is a short-lived, single-use JWT issued in the 409
   * response. It carries the user ID plus the `trustDevice` flag from the
   * original login attempt so the session can be created with the same
   * parameters.
   */
  async resolveSessionConflict(
    dto: ResolveSessionConflictDTO,
    meta: ISessionMetadata,
  ): Promise<SessionConflictResult> {
    // 1. Verify the session management token
    const payload = this.tokenService.verifySessionMgmtToken(dto.sessionMgmtToken);
    const userId = Number(payload.sub);

    // 1b. Verify caller IP matches the IP embedded in the token
    if (payload.boundIp !== meta.ipAddress) {
      this.logger.warn(`Session conflict resolution failed — IP mismatch for userId=${userId}`);
      throw new UnauthorizedException('Session management token is not valid from this IP');
    }

    // 2. Validate session ownership before consuming the token so a bad
    //    terminateSessionId doesn't burn the single-use token.
    const targetSession = await this.sessionRepo.findById(dto.terminateSessionId);
    if (!targetSession || targetSession.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    // 3. Enforce single-use via cache (strict mode — fails if Redis is down)
    const tokenHash = this.tokenService.hashToken(dto.sessionMgmtToken);
    const ttlSeconds = Math.ceil(parseDurationMs(SESSION_MGMT_TOKEN_EXPIRY) / 1000);
    const isFirstUse = await this.cache.setIfAbsentStrict(
      `${SESSION_MGMT_CONSUMED_PREFIX}:${tokenHash}`,
      true,
      ttlSeconds,
    );
    if (!isFirstUse) {
      throw new UnauthorizedException('Session management token has already been used');
    }
    // 4. Terminate the validated session
    await this.sessionRepo.delete(dto.terminateSessionId);
    await this.sessionCache.invalidateSession(userId, dto.terminateSessionId);

    // 5. Re-check count < MAX to guard against race conditions.
    //    The terminated session is already gone — if the limit is still exceeded
    //    (e.g. another login created a session between our delete and this check),
    //    return a fresh conflict payload so the client can retry.
    const count = await this.sessionRepo.countByUserId(userId);
    if (count >= MAX_CONCURRENT_SESSIONS) {
      const raw = await this.sessionRepo.findAllByUserId(userId);
      const sessions = raw.map(AuthService.sanitizeSessionForConflict);

      const freshToken = this.tokenService.signSessionMgmtToken(
        {
          sub: String(userId),
          trustDevice: payload.trustDevice,
          boundIp: payload.boundIp,
        },
        SESSION_MGMT_TOKEN_EXPIRY,
      );

      throw new ConflictException({
        message: getAuthErrorMessage(AuthErrorCode.MAX_SESSIONS_REACHED),
        data: {
          code: AuthErrorCode.MAX_SESSIONS_REACHED,
          sessions,
          sessionMgmtToken: freshToken,
        },
      });
    }

    // 6. Look up user fresh from DB
    const user = await this.userService.findForLoginById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(AuthErrorCode.CONTACT_ADMINISTRATOR);
    }

    // 7. Create the login session
    const session = await this.createLoginSession(user, meta);

    // 8. Optionally create trust token
    let trustToken: string | undefined;
    let trustExpiresAt: Date | undefined;

    if (payload.trustDevice) {
      const trust = await this.trustedDeviceService.createTrustToken(userId, {
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      trustToken = trust.rawToken;
      trustExpiresAt = trust.expiresAt;
    }

    return { ...session, trustToken, trustExpiresAt };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // login() helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async validateLoginCredentials(dto: LoginDTO): Promise<UserForLogin> {
    const user = await this.userService.findForLogin(dto.email);

    // Use the same generic error for wrong email and missing password hash so that
    // an attacker cannot distinguish "email not found" from "wrong password".
    if (!user || !user.passwordHash) {
      this.logger.warn(`Login failed [${AuthErrorCode.INVALID_CREDENTIALS}] email=${dto.email}`);
      throw createAuthError(AuthErrorCode.INVALID_CREDENTIALS);
    }

    // Time-based auto-lockout — reject while the lockout window is still active.
    // Specific message is acceptable: lockout only occurs after many prior failed attempts.
    if (user.loginAttemptsLockout && user.loginAttemptsLockout > new Date()) {
      this.logger.warn(`Login failed [${AuthErrorCode.ACCOUNT_LOCKED}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.ACCOUNT_LOCKED);
    }

    // Verify password BEFORE revealing account status — prevents account enumeration.
    // PENDING/REJECTED/INACTIVE messages must only appear to someone with the correct password.
    const passwordValid = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.userService.recordFailedAttempt(user);
      this.logger.warn(`Login failed [${AuthErrorCode.INVALID_CREDENTIALS}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.INVALID_CREDENTIALS);
    }

    if (user.isDeleted) {
      this.logger.warn(`Login failed [${AuthErrorCode.DELETED}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.DELETED);
    }

    if (user.status === UserStatus.PENDING) {
      this.logger.warn(`Login failed [${AuthErrorCode.PENDING}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.PENDING);
    }
    if (user.status === UserStatus.REJECTED) {
      this.logger.warn(`Login failed [${AuthErrorCode.REJECTED}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.REJECTED);
    }
    if (user.status === UserStatus.SUSPENDED) {
      this.logger.warn(`Login failed [${AuthErrorCode.SUSPENDED}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.SUSPENDED);
    }
    if (user.status === UserStatus.INACTIVE) {
      this.logger.warn(`Login failed [${AuthErrorCode.INACTIVE}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.INACTIVE);
    }
    if (user.status === UserStatus.INVITED) {
      this.logger.warn(`Login failed [${AuthErrorCode.INVITED}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.INVITED);
    }
    if (user.status === UserStatus.REVOKED) {
      this.logger.warn(`Login failed [${AuthErrorCode.REVOKED}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.REVOKED);
    }

    if (!user.isCredentialEnabled) {
      this.logger.warn(`Login failed [${AuthErrorCode.CREDENTIALS_DISABLED}] userId=${user.id}`);
      throw createAuthError(AuthErrorCode.CREDENTIALS_DISABLED);
    }

    return user;
  }

  private async createLoginSession(
    user: UserForLogin,
    meta: ISessionMetadata,
  ): Promise<AuthSessionResult> {
    const refreshExpiry = this.config.get<string>('app.jwt.refreshExpiry') ?? '7d';
    const refreshMs = parseDurationMs(refreshExpiry, FALLBACK_REFRESH_MS);
    const expiresAt = new Date(Date.now() + refreshMs);

    const { signedRefreshToken, sessionId } = await this.sessionRepo.createLoginSession(
      user.id,
      expiresAt,
      (sid) =>
        this.tokenService.signRefreshToken(
          { sub: String(user.id), sessionId: String(sid) },
          refreshExpiry,
        ),
      (raw) => this.tokenService.hashToken(raw),
      meta,
    );

    // Fire-and-forget: reset login counter independently of session creation.
    this.userService.clearLoginAttempts(user.id).catch(() => {
      /* fire-and-forget */
    });

    const { accessExpiry, expiresIn } = this.getAccessTokenConfig();
    const accessToken = this.tokenService.signAccessToken(
      { sub: String(user.id), sessionId: String(sessionId) },
      accessExpiry,
    );

    return {
      vm: {
        user: {
          id: user.id,
          email: user.email,
          roles: user.userRoles.map((ur) => ur.role),
          status: user.status,
          isTwoFactorRequired: user.isTwoFactorEnforced && !user.isTwoFactorEnabled,
        },
      },
      accessToken,
      expiresIn,
      refreshToken: signedRefreshToken,
      refreshMs,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // refresh() helpers
  // ──────────────────────────────────────────────────────────────────────────

  private validateRefreshPayload(rawToken: string | undefined): {
    payload: IRefreshTokenPayload;
    sessionId: number;
    userId: number;
    token: string;
  } {
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const payload = this.tokenService.verifyRefreshToken(rawToken);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // JWT sub and sessionId are stored as strings; Session.id and userId are Int
    return {
      payload,
      sessionId: Number(payload.sessionId),
      userId: Number(payload.sub),
      token: rawToken,
    };
  }

  private async verifySessionIntegrity(
    sessionId: number,
    userId: number,
    rawToken: string,
  ): Promise<SessionWithUser> {
    const session = await this.sessionRepo.findWithUser(sessionId);

    // Session not found → potential theft → revoke all sessions for this user
    if (!session) {
      await this.sessionRepo.deleteAllByUserId(userId);
      await this.sessionCache.invalidateAllUserSessions(userId);
      throw new UnauthorizedException('Session revoked — all sessions terminated');
    }

    // userId mismatch → crafted token → revoke all sessions of the actual session owner
    if (session.userId !== userId) {
      await this.sessionRepo.deleteAllByUserId(session.userId);
      await this.sessionCache.invalidateAllUserSessions(session.userId);
      throw new UnauthorizedException('Session revoked — all sessions terminated');
    }

    // Hash mismatch → token reuse → revoke all sessions for this user
    const incomingHash = this.tokenService.hashToken(rawToken);
    if (incomingHash !== session.refreshTokenHash) {
      await this.sessionRepo.deleteAllByUserId(userId);
      await this.sessionCache.invalidateAllUserSessions(userId);
      throw new UnauthorizedException('Token reuse detected');
    }

    if (session.expiresAt < new Date()) {
      await this.sessionRepo.delete(session.id);
      await this.sessionCache.invalidateSession(userId, sessionId);
      throw new UnauthorizedException('Session expired');
    }
    if (session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account not active');
    }

    return session;
  }

  private async rotateTokens(
    session: SessionWithUser,
    payload: IRefreshTokenPayload,
    meta: ISessionMetadata,
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    remainingMs: number;
  }> {
    // Token rotation — preserve the original expiresAt, do NOT extend the session
    const remainingMs = session.expiresAt.getTime() - Date.now();
    // Floor to 60s minimum — a sub-second window between the expiry check above and
    // now would otherwise produce '0s', issuing a token that is immediately expired.
    const remainingExpiry = `${Math.max(60, Math.floor(remainingMs / 1000))}s`;
    const { accessExpiry, expiresIn } = this.getAccessTokenConfig();

    const { newSignedRefreshToken, accessToken } = await this.sessionRepo.rotateSession(
      session.id,
      session.userId,
      session.expiresAt,
      (sid) =>
        this.tokenService.signRefreshToken(
          { sub: payload.sub, sessionId: String(sid) },
          remainingExpiry,
        ),
      (sid) =>
        this.tokenService.signAccessToken(
          { sub: payload.sub, sessionId: String(sid) },
          accessExpiry,
        ),
      (raw) => this.tokenService.hashToken(raw),
      meta,
    );

    // Invalidate the old session cache entry (old session was deleted inside the transaction)
    await this.sessionCache.invalidateSession(Number(payload.sub), session.id);

    return {
      accessToken,
      expiresIn,
      refreshToken: newSignedRefreshToken,
      remainingMs,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────────────────────────────────

  private getAccessTokenConfig(): { accessExpiry: string; expiresIn: number } {
    const accessExpiry = this.config.get<string>('app.jwt.accessExpiry') ?? '15m';
    return {
      accessExpiry,
      expiresIn: Math.floor(parseDurationMs(accessExpiry) / 1000),
    };
  }

  async changePassword(
    dto: ChangePasswordDTO,
    userId: number,
    sessionId: number,
  ): Promise<{ message: string }> {
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(CREDENTIAL_REUSE_MSG);
    }

    const user = await this.userService.findPasswordHash(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isValid = await this.passwordService.compare(dto.currentPassword, user.passwordHash);

    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    // Check previous password
    if (
      user.previousPasswordHash &&
      (await this.passwordService.compare(dto.newPassword, user.previousPasswordHash))
    ) {
      throw new BadRequestException(PREVIOUS_CREDENTIAL_REUSE_MSG);
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.userService.updatePasswordAndRevokeOtherSessions(userId, newPasswordHash, sessionId);

    // Broad cache invalidation: all entries are cleared, including the kept session.
    // The kept session will re-warm from DB on the next request (one cache miss).
    // This is acceptable because invalidating only revoked sessions would require
    // enumerating session IDs, which adds complexity for minimal gain.
    await this.sessionCache.invalidateAllUserSessions(userId);

    return { message: 'Password changed successfully' };
  }

  async confirmTwoFactorSetup(
    userId: number,
    code: string,
    currentSessionId: number,
  ): Promise<ITwoFactorBackupCodes> {
    const result = await this.db.$transaction(async (tx) => {
      const res = await this.twoFactorService.confirmSetup(userId, code, tx);
      await this.sessionRepo.deleteAllByUserIdExcept(userId, currentSessionId, tx);
      return res;
    });
    await this.sessionCache.invalidateAllUserSessions(userId);
    return result;
  }

  async logoutAll(userId: number, currentSessionId: number): Promise<{ message: string }> {
    await this.sessionRepo.deleteAllByUserIdExcept(userId, currentSessionId);
    await this.sessionCache.invalidateAllUserSessions(userId);
    return { message: 'All other sessions have been logged out' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Session management
  // ──────────────────────────────────────────────────────────────────────────

  async listSessions(
    userId: number,
    currentSessionId: number,
  ): Promise<(SessionInfoVM & { isCurrent: boolean })[]> {
    const sessions = await this.sessionRepo.findAllByUserId(userId);
    return sessions.map((s) => ({
      ...AuthService.enrichSession(s),
      isCurrent: s.id === currentSessionId,
    }));
  }

  async terminateSession(
    userId: number,
    currentSessionId: number,
    targetSessionId: number,
  ): Promise<void> {
    if (targetSessionId === currentSessionId) {
      throw new BadRequestException('Cannot terminate the current session. Use logout instead.');
    }

    const session = await this.sessionRepo.findById(targetSessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepo.delete(targetSessionId);
    await this.sessionCache.invalidateSession(userId, targetSessionId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Session limit helper
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Throws 409 if the user has reached {@link MAX_CONCURRENT_SESSIONS}.
   *
   * The 409 response includes a short-lived `sessionMgmtToken` that the client
   * can use to call `POST /auth/sessions/resolve-conflict` without needing
   * auth tokens (which haven't been issued yet at this point).
   *
   * A per-user Redis lock prevents two concurrent logins from both passing the
   * count check and each creating a session. If the lock cannot be acquired
   * (e.g. Redis outage or contention), the check proceeds without the lock
   * to avoid blocking logins entirely — the worst case is one extra session.
   */
  private async enforceSessionLimit(
    userId: number,
    context: { trustDevice: boolean; ipAddress: string | undefined },
  ): Promise<void> {
    const lockKey = `${SESSION_LIMIT_LOCK_PREFIX}:${userId}`;
    let lockAcquired = await this.cache.setIfAbsent(lockKey, '1', SESSION_LIMIT_LOCK_TTL_SECONDS);

    if (!lockAcquired) {
      // Another login for this user is in progress — wait briefly for it to
      // complete so our count check sees the up-to-date session count.
      await new Promise((resolve) => setTimeout(resolve, 300));
      lockAcquired = await this.cache.setIfAbsent(lockKey, '1', SESSION_LIMIT_LOCK_TTL_SECONDS);
    }

    try {
      const count = await this.sessionRepo.countByUserId(userId);
      if (count >= MAX_CONCURRENT_SESSIONS) {
        this.logger.warn(
          `Login failed [${AuthErrorCode.MAX_SESSIONS_REACHED}] userId=${userId} count=${count}`,
        );
        const raw = await this.sessionRepo.findAllByUserId(userId);
        const sessions = raw.map(AuthService.sanitizeSessionForConflict);

        const sessionMgmtToken = this.tokenService.signSessionMgmtToken(
          {
            sub: String(userId),
            trustDevice: context.trustDevice,
            boundIp: context.ipAddress ?? 'unknown',
          },
          SESSION_MGMT_TOKEN_EXPIRY,
        );

        throw new ConflictException({
          message: getAuthErrorMessage(AuthErrorCode.MAX_SESSIONS_REACHED),
          data: {
            code: AuthErrorCode.MAX_SESSIONS_REACHED,
            sessions,
            sessionMgmtToken,
          },
        });
      }
    } finally {
      if (lockAcquired) {
        this.cache.delete(lockKey).catch(() => {
          /* fire-and-forget — lock expires via TTL anyway */
        });
      }
    }
  }

  /** Enriches a raw session row with parsed user-agent and geo-location fields. */
  private static enrichSession(s: SessionListItem): SessionInfoVM {
    const ua = parseUserAgent(s.userAgent);
    const geo = s.metadata as GeoLocationResult | null;
    return {
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      metadata: s.metadata,
      browser: ua?.browser ?? null,
      os: ua?.os ?? null,
      device: ua?.device ?? null,
      location: geo ?? null,
    };
  }

  /**
   * Returns a sanitized session view for 409 conflict responses.
   * Strips raw IP addresses, user-agent strings, and raw metadata to avoid
   * leaking PII to unauthenticated callers. Parsed browser, OS, device, and
   * approximate location are deliberately kept so the user can identify which
   * session to terminate (the caller has already proven valid credentials).
   */
  private static sanitizeSessionForConflict(s: SessionListItem): SessionInfoVM {
    const ua = parseUserAgent(s.userAgent);
    const geo = s.metadata as GeoLocationResult | null;
    return {
      id: s.id,
      ipAddress: null,
      userAgent: null,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      metadata: null,
      browser: ua?.browser ?? null,
      os: ua?.os ?? null,
      device: ua?.device ?? null,
      location: geo ?? null,
    };
  }
}
