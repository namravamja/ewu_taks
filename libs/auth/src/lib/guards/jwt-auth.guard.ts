import { ALLOW_PENDING_KEY, IS_PUBLIC_KEY, SKIP_TWO_FACTOR_ENFORCEMENT_KEY } from '@mediastar/core';
import { UserStatus } from '@mediastar/database';
import type { IUserContext } from '@mediastar/shared';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { TokenService } from '../jwt/token.service';
import type { ICachedSession } from '../session/cached-session.interface';
import { SessionRepository } from '../session/session.repository';
import { SessionCacheService } from '../session/session-cache.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly sessionRepo: SessionRepository,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Extract the raw JWT from Authorization: Bearer <token>
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const payload = this.tokenService.verifyAccessToken(token);

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const sessionId = Number(payload.sessionId);
    const userId = Number(payload.sub);

    // 6. Cache-aside: check cache first, fall back to DB, populate cache on miss
    const cached = await this.sessionCache.get(userId, sessionId);
    const sessionData = cached ?? (await this.fetchAndCacheSession(userId, sessionId));

    // 7. Session must exist and belong to the token's subject
    if (!sessionData || sessionData.userId !== userId) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    // 8. Belt-and-suspenders expiry check (JWT exp already validates this, but DB is authoritative)
    if (new Date(sessionData.expiresAt) < new Date()) {
      this.sessionRepo.delete(sessionId).catch(() => {
        /* fire-and-forget */
      });
      this.sessionCache.invalidateSession(userId, sessionId).catch(() => {
        /* fire-and-forget */
      });
      throw new UnauthorizedException('Session expired');
    }

    // 9. User account checks
    this.enforceAccountStatus(sessionData.status, context);

    // 10. Two-factor enforcement check
    this.enforceTwoFactor(sessionData, context);

    const userContext: IUserContext = {
      userId,
      email: sessionData.email,
      roles: sessionData.roles,
      effectiveRoleLevel: sessionData.effectiveRoleLevel,
      sessionId,
    };
    request.user = userContext;

    return true;
  }

  /**
   * Extracts the raw JWT string from the Authorization: Bearer <token> header.
   */
  private extractToken(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }

  private enforceAccountStatus(status: UserStatus, context: ExecutionContext): void {
    if (status === UserStatus.PENDING) {
      const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (!allowPending)
        throw new ForbiddenException('Your account is pending administrator approval');
    } else if (status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended. Contact your administrator');
    } else if (status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account has been deactivated');
    } else if (status === UserStatus.REJECTED) {
      throw new UnauthorizedException('Account has been rejected');
    } else if (status === UserStatus.INVITED) {
      throw new UnauthorizedException('Please accept your invitation to access your account');
    } else if (status === UserStatus.REVOKED) {
      throw new UnauthorizedException('Account access has been revoked');
    } else if (status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account not active');
    }
  }

  private enforceTwoFactor(sessionData: ICachedSession, context: ExecutionContext): void {
    const skipTwoFactorEnforcement = this.reflector.getAllAndOverride<boolean>(
      SKIP_TWO_FACTOR_ENFORCEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      skipTwoFactorEnforcement ||
      sessionData.isTwoFactorEnabled ||
      !sessionData.isTwoFactorEnforced
    ) {
      return;
    }

    const gracePeriodEnd = sessionData.twoFactorGracePeriodEnd
      ? new Date(sessionData.twoFactorGracePeriodEnd)
      : null;

    if (!gracePeriodEnd || gracePeriodEnd < new Date()) {
      throw new ForbiddenException({
        message: 'Two-factor authentication setup is required. Your grace period has expired.',
        data: { code: 'TWO_FACTOR_SETUP_REQUIRED' },
      });
    }
  }

  /**
   * Fetches session + user from the database and populates the cache on success.
   * Returns null when the session does not exist.
   */
  private async fetchAndCacheSession(
    userId: number,
    sessionId: number,
  ): Promise<ICachedSession | null> {
    const session = await this.sessionRepo.findSessionForAuth(sessionId);

    if (!session) return null;

    const roles = session.user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    }));

    const effectiveRoleLevel =
      session.user.userRoles.length > 0
        ? Math.max(...session.user.userRoles.map((ur) => ur.role.level))
        : 0;

    const data: ICachedSession = {
      userId: session.userId,
      email: session.user.email,
      roles,
      effectiveRoleLevel,
      expiresAt: session.expiresAt.toISOString(),
      status: session.user.status,
      isTwoFactorEnabled: session.user.isTwoFactorEnabled,
      isTwoFactorEnforced: session.user.isTwoFactorEnforced,
      twoFactorGracePeriodEnd: session.user.twoFactorGracePeriodEnd?.toISOString() ?? null,
    };

    // Fire-and-forget — cache write failure is non-fatal
    this.sessionCache.set(userId, sessionId, data).catch(() => {
      /* fire-and-forget */
    });

    return data;
  }
}
