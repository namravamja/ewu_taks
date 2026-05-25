import { createHash, randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import * as jwt from 'jsonwebtoken';

import { JWT_AUDIENCE, JWT_ISSUER } from '../constants';
import type {
  IAccessTokenPayload,
  IRefreshTokenPayload,
  ISessionMgmtTokenPayload,
  ITwoFactorTokenPayload,
} from './jwt-payload.interface';

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly twoFactorSecret: string;
  private readonly sessionMgmtSecret: string;

  constructor(private readonly config: ConfigService) {
    this.accessSecret = this.config.getOrThrow<string>('app.jwt.secret');
    this.refreshSecret = this.config.getOrThrow<string>('app.jwt.refreshSecret');
    this.twoFactorSecret = this.config.getOrThrow<string>('app.jwt.twoFactorSecret');
    this.sessionMgmtSecret = this.config.getOrThrow<string>('app.jwt.sessionMgmtSecret');
  }

  verifyAccessToken(token: string): IAccessTokenPayload {
    try {
      const payload: unknown = jwt.verify(token, this.accessSecret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      if (!this.isAccessTokenPayload(payload)) {
        throw new UnauthorizedException('Invalid access token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  verifyRefreshToken(token: string): IRefreshTokenPayload {
    try {
      const payload: unknown = jwt.verify(token, this.refreshSecret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      if (!this.isRefreshTokenPayload(payload)) {
        throw new UnauthorizedException('Invalid refresh token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  signAccessToken(
    payload: Pick<IAccessTokenPayload, 'sub' | 'sessionId'>,
    expiresIn: string,
  ): string {
    const options: SignOptions = {
      expiresIn: expiresIn as SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    };
    return jwt.sign(
      { ...payload, type: 'access' } as Omit<IAccessTokenPayload, 'iat' | 'exp'>,
      this.accessSecret,
      options,
    );
  }

  signRefreshToken(
    payload: Pick<IRefreshTokenPayload, 'sub' | 'sessionId'>,
    expiresIn: string,
  ): string {
    const options: SignOptions = {
      expiresIn: expiresIn as SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    };
    return jwt.sign(
      { ...payload, type: 'refresh' } as Omit<IRefreshTokenPayload, 'iat' | 'exp'>,
      this.refreshSecret,
      options,
    );
  }

  /** Returns sha256 hex digest of the given string. Used to hash refresh JWTs and OTPs before DB storage. */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Generates a cryptographically secure 32-byte hex token (used for password-reset and email-verification links). */
  generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  signTwoFactorToken(
    payload: Pick<ITwoFactorTokenPayload, 'sub' | 'sessionId'>,
    expiresIn: string,
  ): string {
    const options: SignOptions = {
      expiresIn: expiresIn as SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    };
    return jwt.sign(
      { ...payload, type: 'two_factor' } as Omit<ITwoFactorTokenPayload, 'iat' | 'exp'>,
      this.twoFactorSecret,
      options,
    );
  }

  verifyTwoFactorToken(token: string): ITwoFactorTokenPayload {
    try {
      const payload: unknown = jwt.verify(token, this.twoFactorSecret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      if (!this.isTwoFactorTokenPayload(payload)) {
        throw new UnauthorizedException('Invalid two-factor token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired two-factor token');
    }
  }

  signSessionMgmtToken(
    payload: Pick<ISessionMgmtTokenPayload, 'sub' | 'trustDevice' | 'boundIp'>,
    expiresIn: string,
  ): string {
    const options: SignOptions = {
      expiresIn: expiresIn as SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    };
    return jwt.sign(
      { ...payload, sessionId: 'pending', type: 'session_management' } as Omit<
        ISessionMgmtTokenPayload,
        'iat' | 'exp'
      >,
      this.sessionMgmtSecret,
      options,
    );
  }

  verifySessionMgmtToken(token: string): ISessionMgmtTokenPayload {
    try {
      const payload: unknown = jwt.verify(token, this.sessionMgmtSecret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      if (!this.isSessionMgmtTokenPayload(payload)) {
        throw new UnauthorizedException('Invalid session management token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired session management token');
    }
  }

  private hasBasePayloadFields(payload: unknown): payload is Record<string, unknown> {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'sub' in payload &&
      typeof (payload as Record<string, unknown>).sub === 'string' &&
      'sessionId' in payload &&
      typeof (payload as Record<string, unknown>).sessionId === 'string'
    );
  }

  private isAccessTokenPayload(payload: unknown): payload is IAccessTokenPayload {
    return this.hasBasePayloadFields(payload) && payload.type === 'access';
  }

  private isRefreshTokenPayload(payload: unknown): payload is IRefreshTokenPayload {
    return this.hasBasePayloadFields(payload) && payload.type === 'refresh';
  }

  private isTwoFactorTokenPayload(payload: unknown): payload is ITwoFactorTokenPayload {
    return this.hasBasePayloadFields(payload) && payload.type === 'two_factor';
  }

  private isSessionMgmtTokenPayload(payload: unknown): payload is ISessionMgmtTokenPayload {
    return (
      this.hasBasePayloadFields(payload) &&
      payload.sessionId === 'pending' &&
      payload.type === 'session_management' &&
      'trustDevice' in payload &&
      typeof payload.trustDevice === 'boolean' &&
      'boundIp' in payload &&
      typeof payload.boundIp === 'string'
    );
  }
}
