import { CacheService } from '../cache.service';
import { type CacheKeyOption, resolveCacheKey } from '../utils/resolve-cache-key';

export interface CacheableOptions {
  key?: CacheKeyOption;
  ttl?: number;
}

export function Cacheable(options?: CacheableOptions) {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: { cacheService?: CacheService }, ...args: unknown[]) {
      const cacheService = this.cacheService;
      if (!cacheService) {
        return originalMethod.apply(this, args);
      }

      const cacheKey = resolveCacheKey(options?.key, propertyKey as string, args);
      const cached = await cacheService.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      if (result !== undefined && result !== null) {
        await cacheService.set(cacheKey, result, options?.ttl);
      }
      return result;
    };
  };
}
