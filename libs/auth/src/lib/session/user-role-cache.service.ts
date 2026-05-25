import { CacheService } from '@mediastar/core';
import { Injectable } from '@nestjs/common';

import { USER_ROLE_CACHE_PREFIX, USER_ROLE_CACHE_TTL } from '../constants';
import type { ICachedUserRole } from './cached-user-role.interface';

@Injectable()
export class UserRoleCacheService {
  constructor(private readonly cache: CacheService) {}

  async get(userId: number): Promise<ICachedUserRole | null> {
    return this.cache.get<ICachedUserRole>(this.key(userId));
  }

  async set(userId: number, data: ICachedUserRole): Promise<void> {
    await this.cache.set(this.key(userId), data, USER_ROLE_CACHE_TTL);
  }

  async invalidate(userId: number): Promise<void> {
    await this.cache.delete(this.key(userId));
  }

  private key(userId: number): string {
    return `${USER_ROLE_CACHE_PREFIX}:${userId}`;
  }
}
