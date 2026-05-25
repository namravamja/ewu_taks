import {
  Auditable,
  AuditAction,
  AuthThrottle,
  GeoLocationService,
  OtpThrottle,
  RegistrationThrottle,
} from '@mediastar/core';
import { ApiWrappedResponse, ErrorResponseVM, type IUserContext } from '@mediastar/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import {
  DEFAULT_TWO_FACTOR_TRUSTED_DEVICE_TTL_MS,
  INVALID_CODE_DESC,
  TWO_FACTOR_TOKEN_HEADER,
  USER_AGENT_HEADER,
  VALIDATION_ERROR_DESC,
} from './constants';
import { AllowPending } from './decorators/allow-pending.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { SkipTwoFactorEnforcement } from './decorators/skip-two-factor-enforcement.decorator';
import { AuthTokenVM } from './dtos/auth-token.vm';
import { ChangePasswordDTO } from './dtos/change-password.dto';
import { ForgotPasswordDTO } from './dtos/forgot-password.dto';
import { LoginDTO } from './dtos/login.dto';
import { SessionInfoVM } from './dtos/max-sessions.vm';
import { RegisterDTO } from './dtos/register.dto';
import { ResetPasswordDTO } from './dtos/reset-password.dto';
import { ResolveSessionConflictDTO } from './dtos/resolve-session-conflict.dto';
import { SetPasswordDTO } from './dtos/set-password.dto';
import { TwoFactorBackupCodesVM } from './dtos/two-factor-backup-codes.vm';
import { TwoFactorConfirmDTO } from './dtos/two-factor-confirm.dto';
import { TwoFactorDisableDTO } from './dtos/two-factor-disable.dto';
import { TwoFactorLoginVM } from './dtos/two-factor-login.vm';
import { TwoFactorRecoveryConfirmDTO } from './dtos/two-factor-recovery-confirm.dto';
import { TwoFactorSetupVM } from './dtos/two-factor-setup.vm';
import { TwoFactorStatusVM } from './dtos/two-factor-status.vm';
import { TwoFactorVerifyDTO } from './dtos/two-factor-verify.dto';
import { ValidatePasswordTokenDTO } from './dtos/validate-password-token.dto';
import { AuthCookieService } from './services/auth-cookie.service';
import type { TrustedDeviceInfo } from './two-factor/trusted-device.repository';
import { TrustedDeviceService } from './two-factor/trusted-device.service';
import { TwoFactorService } from './two-factor/two-factor.service';

const SESSION_TERMINATED_MSG = 'Session terminated';
const TOKEN_VALID_MSG = 'Token is valid';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly authCookieService: AuthCookieService,
    private readonly geoLocationService: GeoLocationService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @RegistrationThrottle()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiWrappedResponse({
    status: 201,
    description: 'Registration request accepted',
    dataSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'If this email is eligible, you will receive a confirmation email shortly.',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: VALIDATION_ERROR_DESC, type: ErrorResponseVM })
  async register(@Body() dto: RegisterDTO, @Ip() ip: string): Promise<{ message: string }> {
    return this.authService.register(dto, ip);
  }

  @Public()
  @AuthThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.Login,
    entityType: 'session',
    descriptionTemplate: 'User login attempt',
    dtoClass: LoginDTO,
  })
  @ApiOperation({
    summary: 'Authenticate a user',
    description:
      'After a successful login the refresh_token cookie is set automatically in the response.',
  })
  @ApiWrappedResponse({ description: 'Login successful', type: AuthTokenVM })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Maximum concurrent sessions reached',
    type: ErrorResponseVM,
  })
  async login(
    @Body() dto: LoginDTO,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenVM | TwoFactorLoginVM> {
    const trustedDeviceCookie = (req.cookies as Record<string, string | undefined>)?.[
      this.authCookieService.getTrustedDeviceCookieName()
    ];
    const geo = this.geoLocationService.lookup(ip);
    const result = await this.authService.login(
      dto,
      { ipAddress: ip, userAgent, metadata: geo },
      trustedDeviceCookie,
    );

    if (result.requiresTwoFactor) {
      return {
        requiresTwoFactor: true,
        twoFactorToken: result.twoFactorToken,
        expiresIn: result.expiresIn,
      };
    }

    this.authCookieService.setRefreshCookie(res, result.refreshToken, result.refreshMs);
    this.authCookieService.setAccessTokenCookie(res, result.accessToken, result.expiresIn);
    return result.vm;
  }

  @Public()
  @AuthThrottle()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete login with a TOTP or backup code',
    description: 'Sets the refresh_token cookie on success.',
  })
  @ApiWrappedResponse({ description: '2FA verification successful', type: AuthTokenVM })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: INVALID_CODE_DESC,
    type: ErrorResponseVM,
  })
  @ApiHeader({ name: TWO_FACTOR_TOKEN_HEADER, description: 'The two-factor token', required: true })
  async verifyTwoFactor(
    @Body() dto: TwoFactorVerifyDTO,
    @Headers(TWO_FACTOR_TOKEN_HEADER) twoFactorToken: string | undefined,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenVM> {
    if (!twoFactorToken) {
      throw new UnauthorizedException('Missing two-factor token');
    }

    const geo = this.geoLocationService.lookup(ip);
    const result = await this.authService.verifyTwoFactor(
      twoFactorToken,
      dto.code,
      { ipAddress: ip, userAgent, metadata: geo },
      dto.trustDevice ?? false,
    );

    this.authCookieService.setRefreshCookie(res, result.refreshToken, result.refreshMs);
    this.authCookieService.setAccessTokenCookie(res, result.accessToken, result.expiresIn);

    if (result.trustToken && result.trustExpiresAt) {
      const trustedDeviceTtlMs =
        this.config.get<number>('app.twoFactor.trustedDeviceTtlMs') ??
        DEFAULT_TWO_FACTOR_TRUSTED_DEVICE_TTL_MS;
      this.authCookieService.setTrustedDeviceCookie(res, result.trustToken, trustedDeviceTtlMs);
    }

    return result.vm;
  }

  @Public()
  @AuthThrottle()
  @Post('2fa/recover/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a 2FA recovery link via email',
    description:
      'Sends a one-time recovery link to the account email. Requires a valid two-factor token (obtained during login). Rate limited to prevent abuse.',
  })
  @ApiWrappedResponse({
    description: 'Recovery link sent (or silently skipped if account not found / in cooldown)',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  })
  @ApiHeader({ name: TWO_FACTOR_TOKEN_HEADER, description: 'The two-factor token', required: true })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired two-factor token',
    type: ErrorResponseVM,
  })
  async requestTwoFactorRecovery(
    @Headers(TWO_FACTOR_TOKEN_HEADER) twoFactorToken: string | undefined,
  ): Promise<{ message: string }> {
    if (!twoFactorToken) {
      throw new UnauthorizedException('Missing two-factor token');
    }
    return this.authService.requestTwoFactorRecovery(twoFactorToken);
  }

  @Public()
  @AuthThrottle()
  @Post('2fa/recover/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm 2FA recovery using the emailed token',
    description:
      'Resets 2FA for the account. All active sessions are invalidated. The user must log in again and re-configure 2FA.',
  })
  @ApiWrappedResponse({
    description: '2FA reset successfully',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired recovery link',
    type: ErrorResponseVM,
  })
  async confirmTwoFactorRecovery(
    @Body() dto: TwoFactorRecoveryConfirmDTO,
  ): Promise<{ message: string }> {
    return this.authService.confirmTwoFactorRecovery(dto.token);
  }

  @Public()
  @AuthThrottle()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh an access token',
    description: 'Rotates the refresh_token cookie.',
  })
  @ApiWrappedResponse({ status: 200, description: 'Tokens refreshed via cookies' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
    type: ErrorResponseVM,
  })
  async refresh(
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = (req.cookies as Record<string, string | undefined>)?.[
      this.authCookieService.getRefreshCookieName()
    ];
    const geo = this.geoLocationService.lookup(ip);
    try {
      const { accessToken, refreshToken, remainingMs, expiresIn } = await this.authService.refresh(
        rawToken,
        {
          ipAddress: ip,
          userAgent,
          metadata: geo,
        },
      );
      this.authCookieService.setRefreshCookie(res, refreshToken, remainingMs);
      this.authCookieService.setAccessTokenCookie(res, accessToken, expiresIn);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.authCookieService.clearAuthCookies(res);
      }
      throw error;
    }
  }

  @AllowPending()
  @SkipTwoFactorEnforcement()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.Logout,
    entityType: 'session',
    descriptionTemplate: '{actor} logged out',
  })
  @ApiOperation({ summary: 'Log out the current user' })
  @ApiWrappedResponse({
    description: 'Logged out successfully',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Logged out successfully' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  async logout(
    @CurrentUser() user: IUserContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.logout(user.userId, user.sessionId);
    this.authCookieService.clearAuthCookies(res);
    return result;
  }

  @Public()
  @AuthThrottle()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiWrappedResponse({
    description: 'Reset email dispatched (identical response whether the email exists or not)',
    dataSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'If this email exists, a reset link was sent' },
      },
    },
  })
  @ApiResponse({ status: 400, description: VALIDATION_ERROR_DESC, type: ErrorResponseVM })
  async forgotPassword(@Body() dto: ForgotPasswordDTO): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @AuthThrottle()
  @Post('reset-password/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a password-reset token',
    description:
      'Checks that the one-time reset token exists and has not expired, without consuming it. ' +
      'Use this to gate the reset-password form before the user submits a new password.',
  })
  @ApiWrappedResponse({
    description: TOKEN_VALID_MSG,
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: TOKEN_VALID_MSG } },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired reset link',
    type: ErrorResponseVM,
  })
  @ApiResponse({ status: 400, description: VALIDATION_ERROR_DESC, type: ErrorResponseVM })
  async validateResetToken(@Body() dto: ValidatePasswordTokenDTO): Promise<{ message: string }> {
    return this.authService.validateResetToken(dto.token);
  }

  @Public()
  @AuthThrottle()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a one-time token' })
  @ApiWrappedResponse({
    description: 'Password reset successfully',
    dataSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password reset successfully. Please log in again.' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, passwords do not match, or new password same as current',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired reset link',
    type: ErrorResponseVM,
  })
  async resetPassword(@Body() dto: ResetPasswordDTO): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @AuthThrottle()
  @Post('set-password/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a set-password token',
    description:
      'Checks that the one-time set-password token exists and has not expired, without consuming it. ' +
      'Use this to gate the set-password form before the user submits a new password.',
  })
  @ApiWrappedResponse({
    description: TOKEN_VALID_MSG,
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: TOKEN_VALID_MSG } },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired set-password link',
    type: ErrorResponseVM,
  })
  @ApiResponse({ status: 400, description: VALIDATION_ERROR_DESC, type: ErrorResponseVM })
  async validateSetPasswordToken(
    @Body() dto: ValidatePasswordTokenDTO,
  ): Promise<{ message: string }> {
    return this.authService.validateSetPasswordToken(dto.token);
  }

  @Public()
  @AuthThrottle()
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set password using a one-time token (after auth provider switch)' })
  @ApiWrappedResponse({
    description: 'Password set successfully',
    dataSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password set successfully. Please log in.' },
        requiresTwoFactorSetup: {
          type: 'boolean',
          example: false,
          description: 'Whether the user needs to set up 2FA before logging in',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or password same as previous',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired set-password link',
    type: ErrorResponseVM,
  })
  async setPassword(
    @Body() dto: SetPasswordDTO,
  ): Promise<{ message: string; requiresTwoFactorSetup: boolean }> {
    return this.authService.setPasswordViaToken(dto);
  }

  @AllowPending()
  @SkipTwoFactorEnforcement()
  @AuthThrottle()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.SetPassword,
    entityType: 'user',
    descriptionTemplate: '{actor} changed their password',
    dtoClass: ChangePasswordDTO,
  })
  @ApiOperation({ summary: 'Change password for the authenticated user' })
  @ApiWrappedResponse({
    description: 'Password changed successfully',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Password changed successfully' } },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or passwords do not match',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Current password incorrect',
    type: ErrorResponseVM,
  })
  async changePassword(
    @Body() dto: ChangePasswordDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(dto, user.userId, user.sessionId);
  }

  @SkipTwoFactorEnforcement()
  @AuthThrottle()
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.TwoFactorSetup,
    entityType: 'user',
    descriptionTemplate: '{actor} initiated 2FA setup',
  })
  @ApiOperation({ summary: 'Generate TOTP secret and QR code for 2FA setup' })
  @ApiWrappedResponse({ description: '2FA setup initiated', type: TwoFactorSetupVM })
  @ApiResponse({ status: 400, description: '2FA already enabled', type: ErrorResponseVM })
  async setupTwoFactor(@CurrentUser() user: IUserContext): Promise<TwoFactorSetupVM> {
    return this.twoFactorService.generateSetup(user.userId, user.email);
  }

  @SkipTwoFactorEnforcement()
  @OtpThrottle()
  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.TwoFactorEnable,
    entityType: 'user',
    descriptionTemplate: '{actor} enabled 2FA',
  })
  @ApiOperation({ summary: 'Confirm 2FA setup with a TOTP code and receive backup codes' })
  @ApiWrappedResponse({ description: '2FA enabled successfully', type: TwoFactorBackupCodesVM })
  @ApiResponse({
    status: 400,
    description: '2FA not initiated or already enabled',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: INVALID_CODE_DESC,
    type: ErrorResponseVM,
  })
  async confirmTwoFactor(
    @Body() dto: TwoFactorConfirmDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<TwoFactorBackupCodesVM> {
    return this.authService.confirmTwoFactorSetup(user.userId, dto.code, user.sessionId);
  }

  @AuthThrottle()
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.TwoFactorDisable,
    entityType: 'user',
    descriptionTemplate: '{actor} disabled 2FA',
  })
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  @ApiWrappedResponse({
    description: '2FA disabled successfully',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Two-factor authentication disabled' } },
    },
  })
  @ApiResponse({ status: 400, description: '2FA not enabled', type: ErrorResponseVM })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: INVALID_CODE_DESC,
    type: ErrorResponseVM,
  })
  async disableTwoFactor(
    @Body() dto: TwoFactorDisableDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<{ message: string }> {
    await this.twoFactorService.disable(user.userId, dto.code);
    return { message: 'Two-factor authentication disabled' };
  }

  @SkipTwoFactorEnforcement()
  @Get('2fa/status')
  @ApiOperation({ summary: 'Check 2FA status for the current user' })
  @ApiWrappedResponse({ description: '2FA status', type: TwoFactorStatusVM })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  async getTwoFactorStatus(@CurrentUser() user: IUserContext): Promise<TwoFactorStatusVM> {
    return this.twoFactorService.getStatus(user.userId);
  }

  @AuthThrottle()
  @Post('2fa/backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.TwoFactorBackupRegenerate,
    entityType: 'user',
    descriptionTemplate: '{actor} regenerated 2FA backup codes',
  })
  @ApiOperation({ summary: 'Regenerate backup codes (requires TOTP code)' })
  @ApiWrappedResponse({ description: 'New backup codes generated', type: TwoFactorBackupCodesVM })
  @ApiResponse({ status: 400, description: '2FA not enabled', type: ErrorResponseVM })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: INVALID_CODE_DESC,
    type: ErrorResponseVM,
  })
  async regenerateBackupCodes(
    @Body() dto: TwoFactorConfirmDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<TwoFactorBackupCodesVM> {
    return this.twoFactorService.regenerateBackupCodes(user.userId, dto.code);
  }

  @Public()
  @AuthThrottle()
  @Post('sessions/resolve-conflict')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve a session-limit conflict by terminating a session and completing login',
    description:
      'Accepts a short-lived sessionMgmtToken (returned in the 409 response) and the ID of the session to terminate. ' +
      'On success, the chosen session is killed and the original login completes — returning tokens as if the login had succeeded.',
  })
  @ApiWrappedResponse({
    description: 'Session conflict resolved, login completed',
    type: AuthTokenVM,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or consumed token',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Session limit still exceeded',
    type: ErrorResponseVM,
  })
  async resolveSessionConflict(
    @Body() dto: ResolveSessionConflictDTO,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenVM> {
    const geo = this.geoLocationService.lookup(ip);
    const result = await this.authService.resolveSessionConflict(dto, {
      ipAddress: ip,
      userAgent,
      metadata: geo,
    });

    this.authCookieService.setRefreshCookie(res, result.refreshToken, result.refreshMs);
    this.authCookieService.setAccessTokenCookie(res, result.accessToken, result.expiresIn);

    if (result.trustToken && result.trustExpiresAt) {
      const trustedDeviceTtlMs =
        this.config.get<number>('app.twoFactor.trustedDeviceTtlMs') ??
        DEFAULT_TWO_FACTOR_TRUSTED_DEVICE_TTL_MS;
      this.authCookieService.setTrustedDeviceCookie(res, result.trustToken, trustedDeviceTtlMs);
    }

    return result.vm;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Session management endpoints
  // ──────────────────────────────────────────────────────────────────────────

  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for the current user' })
  @ApiWrappedResponse({ description: 'Active sessions list', type: SessionInfoVM })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  async listSessions(
    @CurrentUser() user: IUserContext,
  ): Promise<(SessionInfoVM & { isCurrent: boolean })[]> {
    return this.authService.listSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.SessionTerminate,
    entityType: 'session',
    entityIdExtractor: (req) => req.params['id'] as string,
    descriptionTemplate: '{actor} terminated session #{entityId}',
  })
  @ApiOperation({ summary: 'Terminate a specific session (not the current one)' })
  @ApiWrappedResponse({
    description: SESSION_TERMINATED_MSG,
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: SESSION_TERMINATED_MSG } },
    },
  })
  @ApiParam({ name: 'id', description: 'Session ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot terminate current session',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
    type: ErrorResponseVM,
  })
  async terminateSession(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<{ message: string }> {
    await this.authService.terminateSession(user.userId, user.sessionId, id);
    return { message: SESSION_TERMINATED_MSG };
  }

  @AuthThrottle()
  @Post('sessions/logout-all')
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: AuditAction.LogoutAll,
    entityType: 'session',
    descriptionTemplate: '{actor} logged out from all other devices',
  })
  @ApiOperation({ summary: 'Log out from all other devices (keep current session)' })
  @ApiWrappedResponse({
    description: 'All other sessions terminated',
    dataSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'All other sessions have been logged out' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  async logoutAll(@CurrentUser() user: IUserContext): Promise<{ message: string }> {
    return this.authService.logoutAll(user.userId, user.sessionId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Trusted devices endpoints
  // ──────────────────────────────────────────────────────────────────────────

  @Get('trusted-devices')
  @ApiOperation({ summary: 'List trusted devices for the current user' })
  @ApiWrappedResponse({ description: 'Trusted devices list' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  async listTrustedDevices(@CurrentUser() user: IUserContext): Promise<TrustedDeviceInfo[]> {
    return this.trustedDeviceService.listForUser(user.userId);
  }

  @Delete('trusted-devices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a single trusted device' })
  @ApiWrappedResponse({
    description: 'Device revoked',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Trusted device revoked' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  async revokeTrustedDevice(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<{ message: string }> {
    await this.trustedDeviceService.revokeById(id, user.userId);
    return { message: 'Trusted device revoked' };
  }

  @Delete('trusted-devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all trusted devices' })
  @ApiWrappedResponse({
    description: 'All devices revoked',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'All trusted devices revoked' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  async revokeAllTrustedDevices(
    @CurrentUser() user: IUserContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.trustedDeviceService.revokeAllForUser(user.userId);
    this.authCookieService.clearTrustedDeviceCookie(res);
    return { message: 'All trusted devices revoked' };
  }
}
