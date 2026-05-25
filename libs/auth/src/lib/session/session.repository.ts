import {
  DatabaseService,
  Prisma,
  PrismaClientKnownRequestError,
  TxClient,
  UserStatus,
} from '@mediastar/database';
import { Injectable } from '@nestjs/common';

import type { ISessionMetadata } from './session-metadata.interface';

/** Lightweight session projection used by session-listing and session-limit features. */
export interface SessionListItem {
  id: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  metadata: Prisma.JsonValue;
}

/** Callback that signs a refresh token given a session ID. */
type SignRefreshFn = (sessionId: number) => string;

/** Return type of {@link SessionRepository.findWithUser}. */
export interface SessionWithUser {
  id: number;
  userId: number;
  refreshTokenHash: string;
  expiresAt: Date;
  user: {
    status: UserStatus;
    email: string;
    userRoles: { role: { name: string; level: number } }[];
  };
}

/** Return type of {@link SessionRepository.findSessionForAuth}. */
export interface SessionForAuth {
  userId: number;
  expiresAt: Date;
  user: {
    status: UserStatus;
    email: string;
    isTwoFactorEnabled: boolean;
    isTwoFactorEnforced: boolean;
    twoFactorGracePeriodEnd: Date | null;
    userRoles: {
      role: { id: number; name: string; level: number };
    }[];
  };
}

@Injectable()
export class SessionRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Creates a login session inside a transaction:
   * 1. Creates the session row (hash placeholder).
   * 2. Calls `signRefresh` with the new session ID to produce the signed JWT.
   * 3. Stores the hashed refresh token on the session.
   */
  async createLoginSession(
    userId: number,
    expiresAt: Date,
    signRefresh: SignRefreshFn,
    hashToken: (raw: string) => string,
    meta: ISessionMetadata,
  ): Promise<{ sessionId: number; signedRefreshToken: string }> {
    return this.db.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          userId,
          refreshTokenHash: '',
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: meta.metadata ?? undefined,
        },
      });

      const signed = signRefresh(session.id);

      await tx.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: hashToken(signed) },
      });

      return { sessionId: session.id, signedRefreshToken: signed };
    });
  }

  /** Fetches a session with user fields needed by the auth guard (includes userRoles with role details). */
  async findSessionForAuth(sessionId: number): Promise<SessionForAuth | null> {
    return this.db.session.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        expiresAt: true,
        user: {
          select: {
            status: true,
            email: true,
            isTwoFactorEnabled: true,
            isTwoFactorEnforced: true,
            twoFactorGracePeriodEnd: true,
            userRoles: {
              select: {
                role: { select: { id: true, name: true, level: true } },
              },
            },
          },
        },
      },
    });
  }

  /** Fetches a session with selected user fields (used by the refresh flow). */
  async findWithUser(sessionId: number): Promise<SessionWithUser | null> {
    return this.db.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        refreshTokenHash: true,
        expiresAt: true,
        user: {
          select: {
            status: true,
            email: true,
            userRoles: {
              select: {
                role: { select: { name: true, level: true } },
              },
            },
          },
        },
      },
    });
  }

  /** Deletes all sessions for a user (theft detection / password reset). */
  async deleteAllByUserId(userId: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.session.deleteMany({ where: { userId } });
  }

  /** Deletes all sessions for a user except the specified one (change-password flow). */
  async deleteAllByUserIdExcept(
    userId: number,
    keepSessionId: number,
    tx?: TxClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  }

  /**
   * Deletes a single session by ID. Silently ignores P2025 (record not found)
   * so that double-logout or race conditions do not throw.
   */
  async delete(sessionId: number): Promise<void> {
    await this.db.session.delete({ where: { id: sessionId } }).catch((err: unknown) => {
      if (!(err instanceof PrismaClientKnownRequestError && err.code === 'P2025')) {
        throw err;
      }
    });
  }

  /** Deletes all sessions that have expired. Returns the number of deleted rows. */
  async deleteExpired(): Promise<number> {
    const { count } = await this.db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }

  /** Counts active (non-expired) sessions for a user. */
  async countByUserId(userId: number): Promise<number> {
    return this.db.session.count({
      where: { userId, expiresAt: { gt: new Date() } },
    });
  }

  /** Lists all active sessions for a user, newest first. */
  async findAllByUserId(userId: number): Promise<SessionListItem[]> {
    return this.db.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Finds a single active (non-expired) session by ID (includes userId for ownership checks). */
  async findById(sessionId: number): Promise<(SessionListItem & { userId: number }) | null> {
    return this.db.session.findFirst({
      where: { id: sessionId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        metadata: true,
      },
    });
  }

  /**
   * Rotates a refresh session inside a transaction:
   * 1. Deletes the old session.
   * 2. Creates a new session preserving the original expiresAt.
   * 3. Signs a new refresh token and stores its hash.
   * 4. Signs a new access token.
   *
   * Returns both the new signed refresh token and the new access token.
   */
  async rotateSession(
    oldSessionId: number,
    userId: number,
    expiresAt: Date,
    signRefresh: SignRefreshFn,
    signAccess: (sessionId: number) => string,
    hashToken: (raw: string) => string,
    meta: ISessionMetadata,
  ): Promise<{ newSignedRefreshToken: string; accessToken: string }> {
    return this.db.$transaction(async (tx) => {
      await tx.session.delete({ where: { id: oldSessionId } });

      const newSession = await tx.session.create({
        data: {
          userId,
          refreshTokenHash: '',
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: meta.metadata ?? undefined,
        },
      });

      const newSigned = signRefresh(newSession.id);

      await tx.session.update({
        where: { id: newSession.id },
        data: { refreshTokenHash: hashToken(newSigned) },
      });

      const accessToken = signAccess(newSession.id);

      return { newSignedRefreshToken: newSigned, accessToken };
    });
  }
}
