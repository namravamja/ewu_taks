import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import type Redis from 'ioredis';

import {
  DEFAULT_CACHE_TTL,
  LRU_MAX_ENTRIES,
  REDIS_CLIENT,
  REDIS_SUBSCRIBER,
} from '../constants/index';
import { AppLoggerService } from '../logger/logger.service';
import { LruCache } from './lru-cache';

/** Handler signature for `subscribe()`. Receives the published message string. */
export type PubSubHandler = (message: string) => void;

/** One XRANGE result entry: `[redisStreamId, fields]`. */
export type StreamEntry = readonly [string, Record<string, string>];

/** CAS-delete: drop the key only when it still holds the expected token. */
const LUA_DELETE_IF_MATCH = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly l1 = new LruCache<string>(LRU_MAX_ENTRIES);

  /**
   * Per-channel handler sets. We use a ref-counted subscribe — the underlying
   * ioredis SUBSCRIBE is only issued on first handler for a channel, and the
   * matching UNSUBSCRIBE is only issued when the last handler disconnects.
   */
  private readonly pubsubHandlers = new Map<string, Set<PubSubHandler>>();

  /** True once the shared `message` listener has been wired on the subscriber. */
  private subscriberListenerAttached = false;

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Optional() @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis | null,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(CacheService.name);
  }

  async get<T>(key: string): Promise<T | null> {
    const l1Value = this.l1.get(key);
    if (l1Value !== undefined) {
      return JSON.parse(l1Value) as T;
    }

    const [l2Value, ttl] = await this.redisGetWithTtl(key);
    if (l2Value !== null) {
      if (ttl > 0) {
        this.l1.set(key, l2Value, ttl * 1000);
      }
      return JSON.parse(l2Value) as T;
    }

    return null;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    if (keys.length === 0) return result;

    const l2Keys: string[] = [];

    for (const key of keys) {
      const l1Value = this.l1.get(key);
      if (l1Value !== undefined) {
        result.set(key, JSON.parse(l1Value) as T);
      } else {
        l2Keys.push(key);
      }
    }

    if (l2Keys.length === 0) return result;

    const l2Results = await this.redisMget(l2Keys);

    for (const [key, [value, ttl]] of l2Results) {
      if (ttl > 0) {
        this.l1.set(key, value, ttl * 1000);
      }
      result.set(key, JSON.parse(value) as T);
    }

    return result;
  }

  async set(key: string, value: unknown, ttlSeconds: number = DEFAULT_CACHE_TTL): Promise<void> {
    const serialized = JSON.stringify(value);
    this.l1.set(key, serialized, ttlSeconds * 1000);
    await this.redisSet(key, serialized, ttlSeconds);
  }

  async getAndDelete<T>(key: string): Promise<T | null> {
    this.l1.delete(key);

    const value = await this.redisGetDel(key);
    if (value !== null) {
      return JSON.parse(value) as T;
    }

    return null;
  }

  async delete(key: string): Promise<void> {
    this.l1.delete(key);
    await this.redisDel(key);
  }

  /**
   * Atomically delete `key` only if its current value equals `expectedValue`.
   * Used for token-scoped lock release so a request that previously held a lock
   * cannot delete a fresh lock acquired by a different request after TTL expiry.
   * Returns `true` if a matching key was deleted, `false` otherwise (mismatch,
   * missing, or Redis unavailable).
   */
  async deleteIfMatch(key: string, expectedValue: unknown): Promise<boolean> {
    const serialized = JSON.stringify(expectedValue);
    this.l1.delete(key);
    if (!this.redis) return false;
    try {
      const result = (await this.redis.eval(LUA_DELETE_IF_MATCH, 1, key, serialized)) as number;
      return result === 1;
    } catch (error) {
      this.logger.warn(`Redis compare-and-delete failed for key "${key}"`, {
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Atomically sets a key only if it does not already exist (Redis SETNX).
   * Returns `true` if the key was set (first caller wins), `false` if it already existed.
   * When Redis is unavailable, falls back to L1 cache with a check-then-set (not atomic
   * across instances, but still prevents replay within a single process).
   */
  async setIfAbsent(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    const serialized = JSON.stringify(value);
    const acquired = await this.redisSetNx(key, serialized, ttlSeconds);

    if (acquired) {
      this.l1.set(key, serialized, ttlSeconds * 1000);
      return true;
    }

    // Redis said key exists — or Redis is unavailable, fall back to L1
    if (acquired === null) {
      // Redis unavailable — best-effort L1 check
      if (this.l1.get(key) !== undefined) return false;
      this.l1.set(key, serialized, ttlSeconds * 1000);
      return true;
    }

    return false;
  }

  /**
   * Strict variant of {@link setIfAbsent} that throws when Redis is unavailable
   * instead of falling back to L1 cache. Use this for security-critical single-use
   * checks (e.g. token replay prevention) where L1-only enforcement is insufficient
   * in a multi-instance deployment.
   */
  async setIfAbsentStrict(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    const serialized = JSON.stringify(value);
    const acquired = await this.redisSetNx(key, serialized, ttlSeconds);

    if (acquired === null) {
      throw new Error('Redis unavailable — cannot enforce single-use token check');
    }

    if (acquired) {
      this.l1.set(key, serialized, ttlSeconds * 1000);
      return true;
    }

    return false;
  }

  async deleteByPattern(pattern: string): Promise<void> {
    this.deleteL1ByPattern(pattern);
    await this.redisScanDel(pattern);
  }

  /**
   * Iterates all L1 keys to find pattern matches. This is a full linear scan,
   * which is acceptable because the L1 LRU cache is capped at {@link LRU_MAX_ENTRIES}
   * (1 000 entries) — the scan completes in sub-millisecond time.
   */
  private deleteL1ByPattern(pattern: string): void {
    const sanitized =
      '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$';
    // Pattern is fully sanitized above — all regex meta-chars escaped
    // eslint-disable-next-line security/detect-non-literal-regexp
    const regex = new RegExp(sanitized);
    for (const key of this.l1.keys()) {
      if (regex.test(key)) {
        this.l1.delete(key);
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {
        // ignore disconnect errors during shutdown
      }
    }
    if (this.subscriber) {
      try {
        this.subscriber.disconnect();
      } catch {
        // ignore disconnect errors during shutdown
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Redis Streams (XADD / XRANGE) + PubSub (PUBLISH / SUBSCRIBE)
  //
  // These primitives underpin the case-ai streaming fan-out layer. They are
  // deliberately thin wrappers — they accept raw string payloads and let the
  // caller serialize. When Redis is unavailable, all methods no-op gracefully
  // and log a warning (same pattern as the rest of the service).
  // ---------------------------------------------------------------------------

  /**
   * Append an entry to a Redis Stream with `MAXLEN ~ <maxLen>` trimming (O(1)).
   *
   * @returns the Redis-assigned stream entry id (e.g. `"1700000000000-0"`),
   *          or `null` when Redis is unavailable or the command failed.
   */
  async xadd(key: string, maxLen: number, fields: Record<string, string>): Promise<string | null> {
    if (!this.redis) return null;
    try {
      const args: string[] = [];
      for (const [k, v] of Object.entries(fields)) {
        args.push(k, v);
      }
      // `MAXLEN ~ N` uses approximate trimming for O(1) performance.
      return await this.redis.xadd(key, 'MAXLEN', '~', maxLen, '*', ...args);
    } catch (error) {
      this.logger.warn(`Redis XADD failed for key "${key}"`, { error: String(error) });
      return null;
    }
  }

  /**
   * Read a range of entries from a Redis Stream.
   *
   * @param startId Redis stream id or `'-'` for the beginning.
   * @param endId   Redis stream id or `'+'` for the end.
   * @param count   optional `COUNT` cap.
   */
  async xrange(key: string, startId = '-', endId = '+', count?: number): Promise<StreamEntry[]> {
    if (!this.redis) return [];
    try {
      const raw =
        count !== undefined
          ? await this.redis.xrange(key, startId, endId, 'COUNT', count)
          : await this.redis.xrange(key, startId, endId);
      return raw.map(([id, fieldArr]) => [id, toFieldMap(fieldArr)] as const);
    } catch (error) {
      this.logger.warn(`Redis XRANGE failed for key "${key}"`, { error: String(error) });
      return [];
    }
  }

  /** Publish a message to a channel. Returns the subscriber count, or 0 on failure. */
  async publish(channel: string, message: string): Promise<number> {
    if (!this.redis) return 0;
    try {
      return await this.redis.publish(channel, message);
    } catch (error) {
      this.logger.warn(`Redis PUBLISH failed for channel "${channel}"`, { error: String(error) });
      return 0;
    }
  }

  /**
   * Subscribe to a channel. Multiple callers can subscribe to the same channel;
   * the underlying ioredis SUBSCRIBE is ref-counted so only one connection-level
   * subscribe is active per channel.
   *
   * @returns an async unsubscribe function. Safe to call multiple times.
   */
  async subscribe(channel: string, handler: PubSubHandler): Promise<() => Promise<void>> {
    if (!this.subscriber) {
      this.logger.warn(
        `Redis subscriber unavailable — subscription to "${channel}" will receive no messages`,
      );
      return async () => {
        /* no-op */
      };
    }

    this.ensureSubscriberListener();

    let handlers = this.pubsubHandlers.get(channel);
    const isFirstSubscriber = !handlers;
    if (!handlers) {
      handlers = new Set();
      this.pubsubHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    if (isFirstSubscriber) {
      try {
        await this.subscriber.subscribe(channel);
      } catch (error) {
        this.logger.warn(`Redis SUBSCRIBE failed for channel "${channel}"`, {
          error: String(error),
        });
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.pubsubHandlers.delete(channel);
        }
      }
    }

    let unsubscribed = false;
    return async () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const current = this.pubsubHandlers.get(channel);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.pubsubHandlers.delete(channel);
        if (this.subscriber) {
          try {
            await this.subscriber.unsubscribe(channel);
          } catch (error) {
            this.logger.warn(`Redis UNSUBSCRIBE failed for channel "${channel}"`, {
              error: String(error),
            });
          }
        }
      }
    };
  }

  /** Set (or refresh) the TTL on an existing key. No-op when Redis is unavailable. */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.expire(key, ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis EXPIRE failed for key "${key}"`, { error: String(error) });
    }
  }

  private ensureSubscriberListener(): void {
    if (this.subscriberListenerAttached || !this.subscriber) return;
    this.subscriberListenerAttached = true;

    this.subscriber.on('message', (channel: string, message: string) => {
      const handlers = this.pubsubHandlers.get(channel);
      if (!handlers) return;
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (error) {
          this.logger.warn(`Redis pub/sub handler threw for channel "${channel}"`, {
            error: String(error),
          });
        }
      }
    });
  }

  /** Returns `true` if key was set, `false` if it already existed, `null` if Redis is unavailable. */
  private async redisSetNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean | null> {
    if (!this.redis) return null;
    try {
      const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`Redis SET NX failed for key "${key}"`, { error: String(error) });
      return null;
    }
  }

  private async redisMget(keys: string[]): Promise<Map<string, [string, number]>> {
    if (!this.redis || keys.length === 0) return new Map();
    try {
      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        pipeline.get(key);
        pipeline.ttl(key);
      }
      const results = await pipeline.exec();
      if (!results) return new Map();

      const map = new Map<string, [string, number]>();
      keys.forEach((key, i) => {
        const getErr = results[i * 2][0];
        const ttlErr = results[i * 2 + 1][0];
        if (getErr || ttlErr) {
          this.logger.warn(`Redis pipeline command failed for key "${key}"`, {
            getError: getErr ? String(getErr) : undefined,
            ttlError: ttlErr ? String(ttlErr) : undefined,
          });
          return;
        }
        const value = results[i * 2][1] as string | null;
        const ttl = (results[i * 2 + 1][1] as number) ?? 0;
        if (value !== null) {
          map.set(key, [value, ttl]);
        }
      });
      return map;
    } catch (error) {
      this.logger.warn('Redis MGET pipeline failed', { error: String(error) });
      return new Map();
    }
  }

  private async redisGetWithTtl(key: string): Promise<[string | null, number]> {
    if (!this.redis) return [null, 0];
    try {
      const results = await this.redis.pipeline().get(key).ttl(key).exec();
      if (!results) return [null, 0];

      const [getResult, ttlResult] = results;
      if (getResult[0] || ttlResult[0]) {
        this.logger.warn(`Redis pipeline command failed for key "${key}"`, {
          getError: getResult[0] ? String(getResult[0]) : undefined,
          ttlError: ttlResult[0] ? String(ttlResult[0]) : undefined,
        });
        return [null, 0];
      }
      const value = getResult[1] as string | null;
      const ttl = (ttlResult[1] as number) ?? 0;

      return [value, ttl];
    } catch (error) {
      this.logger.warn(`Redis GET+TTL pipeline failed for key "${key}"`, { error: String(error) });
      return [null, 0];
    }
  }

  private async redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis SET failed for key "${key}"`, { error: String(error) });
    }
  }

  private async redisGetDel(key: string): Promise<string | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.getdel(key);
    } catch (error) {
      this.logger.warn(`Redis GETDEL failed for key "${key}"`, { error: String(error) });
      return null;
    }
  }

  private async redisDel(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Redis DEL failed for key "${key}"`, { error: String(error) });
    }
  }

  private async redisScanDel(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(`Redis SCAN+DEL failed for pattern "${pattern}"`, { error: String(error) });
    }
  }
}

/**
 * Converts an ioredis flat `[k, v, k, v, ...]` field array (as returned by XRANGE)
 * into a `Record<string, string>`. Odd-length arrays are truncated defensively.
 */
/* eslint-disable security/detect-object-injection -- iterating trusted ioredis XRANGE output, not user input */
function toFieldMap(flat: readonly string[]): Record<string, string> {
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    pairs.push([flat[i], flat[i + 1]]);
  }
  return Object.fromEntries(pairs);
}
/* eslint-enable security/detect-object-injection */
