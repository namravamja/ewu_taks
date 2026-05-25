import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../constants/index';
import { AppLoggerService } from '../logger/logger.service';

const LUA_INCREMENT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local current = redis.call('INCR', key)
local pttl = redis.call('PTTL', key)
if pttl < 0 then
  redis.call('PEXPIRE', key, ttl)
  pttl = ttl
end
return {current, pttl}
`;

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class ThrottlerRedisStorage implements ThrottlerStorage {
  private readonly redis: Redis | null;
  private redisWarningLogged = false;

  constructor(
    @Inject(REDIS_CLIENT) redis: Redis | null,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(ThrottlerRedisStorage.name);
    this.redis = redis;
    if (!redis) {
      this.logger.warn('Redis not available — rate limiting is disabled');
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redis) {
      return this.passThrough();
    }

    try {
      const result = (await this.redis.eval(LUA_INCREMENT, 1, key, ttl)) as [number, number];
      const totalHits = result[0];
      const pttl = result[1];
      const timeToExpire = Math.max(0, Math.ceil(pttl / 1000));
      const isBlocked = totalHits > limit;

      this.logger.debug('Throttle check via Redis', {
        key,
        totalHits,
        limit,
        isBlocked,
      });

      this.redisWarningLogged = false;

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
      };
    } catch (error) {
      if (!this.redisWarningLogged) {
        this.logger.warn('Redis error — rate limiting skipped', {
          error: (error as Error).message,
        });
        this.redisWarningLogged = true;
      }
      return this.passThrough();
    }
  }

  private passThrough(): ThrottlerStorageRecord {
    return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
  }
}
