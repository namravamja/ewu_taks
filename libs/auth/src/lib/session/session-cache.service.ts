import { CacheService } from '@mediastar/core';
import { Injectable } from '@nestjs/common';

import { SESSION_CACHE_PREFIX, SESSION_CACHE_TTL } from '../constants';
import type { ICachedSession } from './cached-session.interface';

@Injectable()
export class SessionCacheService {
  constructor(private readonly cache: CacheService) {}

  async get(userId: number, sessionId: number): Promise<ICachedSession | null> {
    return this.cache.get<ICachedSession>(this.key(userId, sessionId));
  }

  async set(userId: number, sessionId: number, data: ICachedSession): Promise<void> {
    await this.cache.set(this.key(userId, sessionId), data, SESSION_CACHE_TTL);
  }

  async invalidateSession(userId: number, sessionId: number): Promise<void> {
    await this.cache.delete(this.key(userId, sessionId));
  }

  async invalidateAllUserSessions(userId: number): Promise<void> {
    await this.cache.deleteByPattern(`${SESSION_CACHE_PREFIX}:${userId}:*`);
  }

  async invalidateAllSessions(): Promise<void> {
    await this.cache.deleteByPattern(`${SESSION_CACHE_PREFIX}:*`);
  }

  private key(userId: number, sessionId: number): string {
    return `${SESSION_CACHE_PREFIX}:${userId}:${sessionId}`;
  }
}
