import {
  AppLoggerService,
  LruCache,
  PermissionScope,
  REDIS_CLIENT,
  REDIS_SUBSCRIBER,
} from '@mediastar/core';
import { DatabaseService } from '@mediastar/database';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import Redis from 'ioredis';

import {
  RBAC_CACHE_MAX_SIZE,
  RBAC_CACHE_TTL_MS,
  RBAC_INVALIDATION_VERSION_KEY,
  RBAC_PUBLISH_MAX_RETRIES,
  RBAC_PUBLISH_RETRY_DELAY_MS,
  RBAC_PUBSUB_CHANNEL,
  RBAC_SCOPE_HIERARCHY,
  RBAC_SWEEP_INTERVAL_MS,
} from '../constants';
import { PermissionTrie } from './permission-trie';

export interface RoleCacheEntry {
  readonly trie: PermissionTrie;
  readonly scopeMap: ReadonlyMap<string, readonly PermissionScope[]>;
}

function scopeLevel(scope: PermissionScope): number {
  return RBAC_SCOPE_HIERARCHY.get(scope) ?? 0;
}

interface RbacInvalidationMessage {
  readonly type: 'role' | 'all';
  readonly roleId?: number;
}

@Injectable()
export class RbacService implements OnModuleInit, OnModuleDestroy {
  private readonly cache = new LruCache<RoleCacheEntry>(RBAC_CACHE_MAX_SIZE);
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private lastKnownVersion = 0;

  constructor(
    private readonly db: DatabaseService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Optional() @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis | null,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(RbacService.name);
  }

  async onModuleInit(): Promise<void> {
    if (this.subscriber) {
      try {
        this.subscriber.on('message', (_channel: string, message: string) => {
          this.handleInvalidationMessage(message);
        });

        await this.subscriber.subscribe(RBAC_PUBSUB_CHANNEL);
        this.logger.log('RBAC pub/sub subscriber connected');
      } catch (error) {
        this.logger.warn(
          `RBAC subscriber setup failed — operating in L1-only mode: ${(error as Error).message}`,
        );
      }
    }

    this.startSweepTimer();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }

    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(RBAC_PUBSUB_CHANNEL);
      } catch {
        // Connection may already be closed
      }
    }
  }

  async getPermissionsForRole(roleId: number): Promise<RoleCacheEntry> {
    const cached = this.cache.get(String(roleId));
    if (cached) {
      return cached;
    }

    const rolePermissions = await this.db.rolePermission.findMany({
      where: { roleId },
      select: {
        scope: true,
        permission: { select: { module: true, action: true } },
      },
    });

    const permissionStrings: string[] = [];
    const scopeSets = new Map<string, Set<PermissionScope>>();

    for (const rp of rolePermissions) {
      const key = `${rp.permission.module}:${rp.permission.action}`;
      permissionStrings.push(key);

      let set = scopeSets.get(key);
      if (!set) {
        set = new Set<PermissionScope>();
        scopeSets.set(key, set);
      }
      // Cast: Prisma's PermissionScope (string literal union) → core's PermissionScope (enum).
      // Values are identical — the sync test in permission-scope-sync.spec.ts guarantees this.
      set.add(rp.scope as PermissionScope);
    }

    const scopeMap = new Map<string, readonly PermissionScope[]>(
      Array.from(scopeSets, ([key, set]) => [key, [...set]]),
    );
    const trie = PermissionTrie.fromPermissions(permissionStrings);
    const entry: RoleCacheEntry = { trie, scopeMap };

    this.cache.set(String(roleId), entry, RBAC_CACHE_TTL_MS);
    this.logger.debug(`Cached ${permissionStrings.length} permissions for role ${roleId}`);

    return entry;
  }

  async hasPermission(roleId: number, requiredPermission: string): Promise<boolean> {
    const { trie } = await this.getPermissionsForRole(roleId);
    return trie.has(requiredPermission);
  }

  checkPermissionWithEntry(
    entry: RoleCacheEntry,
    module: string,
    action: string,
    requiredScope: PermissionScope,
  ): boolean {
    if (!entry.trie.has(`${module}:${action}`)) {
      return false;
    }

    // For wildcard roles (owner), check the wildcard scope map entry
    const scopes = entry.scopeMap.get(`${module}:${action}`) ?? entry.scopeMap.get('*:*') ?? [];

    const requiredLevel = scopeLevel(requiredScope);

    return scopes.some((grantedScope) => scopeLevel(grantedScope) >= requiredLevel);
  }

  async checkPermissionWithScope(
    roleId: number,
    module: string,
    action: string,
    requiredScope: PermissionScope,
  ): Promise<boolean> {
    const entry = await this.getPermissionsForRole(roleId);
    return this.checkPermissionWithEntry(entry, module, action, requiredScope);
  }

  async checkPermissionWithScopeForRoles(
    roleIds: number[],
    module: string,
    action: string,
    requiredScope: PermissionScope,
  ): Promise<boolean> {
    const entries = await Promise.all(roleIds.map((id) => this.getPermissionsForRole(id)));
    return entries.some((entry) =>
      this.checkPermissionWithEntry(entry, module, action, requiredScope),
    );
  }

  async getEffectiveScope(
    roleIds: number[],
    module: string,
    action: string,
  ): Promise<PermissionScope | null> {
    const entries = await Promise.all(roleIds.map((id) => this.getPermissionsForRole(id)));
    const key = `${module}:${action}`;

    let highestLevel = -1;
    let highestScope: PermissionScope | null = null;

    for (const entry of entries) {
      if (!entry.trie.has(key)) {
        continue;
      }

      const scopes = entry.scopeMap.get(key) ?? entry.scopeMap.get('*:*') ?? [];
      for (const scope of scopes) {
        const level = scopeLevel(scope);
        if (level > highestLevel) {
          highestLevel = level;
          highestScope = scope;
        }
      }
    }

    return highestScope;
  }

  async invalidateRole(roleId: number): Promise<void> {
    this.cache.delete(String(roleId));
    this.logger.debug(`Invalidated cache for role ${roleId}`);
    await this.incrementVersion();
    this.publish({ type: 'role', roleId });
  }

  async invalidateAll(): Promise<void> {
    this.cache.clear();
    this.logger.debug('Invalidated all role caches');
    await this.incrementVersion();
    this.publish({ type: 'all' });
  }

  private async incrementVersion(): Promise<void> {
    if (!this.redis) return;

    try {
      const newVersion = await this.redis.incr(RBAC_INVALIDATION_VERSION_KEY);
      this.lastKnownVersion = newVersion;
    } catch (err) {
      this.logger.warn(`Failed to increment RBAC version key: ${(err as Error).message}`);
    }
  }

  private publish(message: RbacInvalidationMessage): void {
    if (!this.redis) return;

    const payload = JSON.stringify(message);
    let attempt = 0;

    const tryPublish = (): void => {
      this.redis?.publish(RBAC_PUBSUB_CHANNEL, payload).catch((err: Error) => {
        attempt++;
        if (attempt <= RBAC_PUBLISH_MAX_RETRIES) {
          this.logger.debug(`Retrying RBAC publish (attempt ${attempt + 1})`);
          setTimeout(tryPublish, RBAC_PUBLISH_RETRY_DELAY_MS);
        } else {
          this.logger.error(
            `RBAC pub/sub publish failed after ${attempt + 1} attempts: ${err.message}. ` +
              'Other instances will catch up via version sweep.',
          );
        }
      });
    };

    tryPublish();
  }

  private startSweepTimer(): void {
    if (!this.redis) return;

    this.sweepTimer = setInterval(() => {
      this.sweep().catch((err: Error) => {
        this.logger.debug(`RBAC sweep error: ${err.message}`);
      });
    }, RBAC_SWEEP_INTERVAL_MS);
  }

  private async sweep(): Promise<void> {
    if (!this.redis) return;

    const raw = await this.redis.get(RBAC_INVALIDATION_VERSION_KEY);
    if (raw === null) return;

    const currentVersion = parseInt(raw, 10);
    if (Number.isNaN(currentVersion)) return;

    if (currentVersion !== this.lastKnownVersion) {
      const previousVersion = this.lastKnownVersion;
      this.cache.clear();
      this.lastKnownVersion = currentVersion;
      this.logger.debug(
        `RBAC sweep: version ${currentVersion} differs from local ${previousVersion} — cache cleared`,
      );
    }
  }

  private handleInvalidationMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as RbacInvalidationMessage;

      if (message.type === 'all') {
        this.cache.clear();
        this.logger.debug('Cleared all role caches via pub/sub');
      } else if (message.type === 'role' && message.roleId !== undefined) {
        this.cache.delete(String(message.roleId));
        this.logger.debug(`Cleared cache for role ${message.roleId} via pub/sub`);
      }
    } catch {
      this.logger.warn('Received malformed RBAC invalidation message');
    }
  }
}
