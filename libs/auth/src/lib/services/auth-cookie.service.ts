import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import {
  ACCESS_TOKEN_COOKIE_NAME_DEV,
  ACCESS_TOKEN_COOKIE_NAME_PROD,
  ACCESS_TOKEN_COOKIE_NAME_STG,
  ACCESS_TOKEN_COOKIE_PATH,
  REFRESH_COOKIE_NAME_DEV,
  REFRESH_COOKIE_NAME_PROD,
  REFRESH_COOKIE_NAME_STG,
  REFRESH_COOKIE_PATH,
  resolveCookieName,
  TRUSTED_DEVICE_COOKIE_NAME_DEV,
  TRUSTED_DEVICE_COOKIE_NAME_PROD,
  TRUSTED_DEVICE_COOKIE_NAME_STG,
  TRUSTED_DEVICE_COOKIE_PATH,
} from '../constants';

@Injectable()
export class AuthCookieService {
  private readonly isSecure: boolean;
  private readonly cookieDomain: string | undefined;
  private readonly refreshCookieName: string;
  private readonly trustedDeviceCookieName: string;
  private readonly accessTokenCookieName: string;

  constructor(private readonly config: ConfigService) {
    const nodeEnv = this.config.get<string>('app.nodeEnv') ?? 'development';
    this.isSecure = nodeEnv !== 'development' && nodeEnv !== 'test';
    this.cookieDomain = this.config.get<string>('app.cookie.domain') || undefined;

    this.refreshCookieName = resolveCookieName(
      nodeEnv,
      REFRESH_COOKIE_NAME_DEV,
      REFRESH_COOKIE_NAME_STG,
      REFRESH_COOKIE_NAME_PROD,
    );
    this.trustedDeviceCookieName = resolveCookieName(
      nodeEnv,
      TRUSTED_DEVICE_COOKIE_NAME_DEV,
      TRUSTED_DEVICE_COOKIE_NAME_STG,
      TRUSTED_DEVICE_COOKIE_NAME_PROD,
    );
    this.accessTokenCookieName = resolveCookieName(
      nodeEnv,
      ACCESS_TOKEN_COOKIE_NAME_DEV,
      ACCESS_TOKEN_COOKIE_NAME_STG,
      ACCESS_TOKEN_COOKIE_NAME_PROD,
    );
  }

  /** Returns the env-aware refresh cookie name. */
  getRefreshCookieName(): string {
    return this.refreshCookieName;
  }

  /** Returns the env-aware trusted device cookie name. */
  getTrustedDeviceCookieName(): string {
    return this.trustedDeviceCookieName;
  }

  /** Returns the env-aware access-token cookie name. */
  getAccessTokenCookieName(): string {
    return this.accessTokenCookieName;
  }

  setRefreshCookie(res: Response, token: string, maxAge: number): void {
    res.cookie(this.refreshCookieName, token, {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge,
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });
  }

  setTrustedDeviceCookie(res: Response, token: string, maxAge: number): void {
    res.cookie(this.trustedDeviceCookieName, token, {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: 'strict',
      path: TRUSTED_DEVICE_COOKIE_PATH,
      maxAge,
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });
  }

  /**
   * Sets the access-token cookie as a JS-readable (`httpOnly: false`) cookie.
   *
   * `httpOnly: false` is intentional — the SPA reads this cookie to attach
   * the token as a `Bearer` header on API requests and to derive UI state
   * (e.g. whether the user is logged in). The risk is mitigated by:
   *
   * - Short TTL (access token lifetime minus 60 s buffer).
   * - `Secure` flag in production (prevents transmission over plain HTTP).
   * - `SameSite=Strict` (prevents cross-site request attachment).
   */
  setAccessTokenCookie(res: Response, accessToken: string, expiresInSeconds: number): void {
    res.cookie(this.accessTokenCookieName, accessToken, {
      httpOnly: false,
      secure: this.isSecure,
      sameSite: 'strict',
      path: ACCESS_TOKEN_COOKIE_PATH,
      maxAge: Math.max(0, expiresInSeconds - 60) * 1000,
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });
  }

  clearAuthCookies(res: Response): void {
    const domainOpt = this.cookieDomain ? { domain: this.cookieDomain } : {};

    res.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      ...domainOpt,
    });
    res.clearCookie(this.accessTokenCookieName, {
      httpOnly: false,
      secure: this.isSecure,
      sameSite: 'strict',
      path: ACCESS_TOKEN_COOKIE_PATH,
      ...domainOpt,
    });
  }

  clearTrustedDeviceCookie(res: Response): void {
    res.clearCookie(this.trustedDeviceCookieName, {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: 'strict',
      path: TRUSTED_DEVICE_COOKIE_PATH,
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });
  }
}
