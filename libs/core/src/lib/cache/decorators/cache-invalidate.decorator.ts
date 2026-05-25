import { CacheService } from '../cache.service';
import { type CacheKeyOption, resolveCacheKey } from '../utils/resolve-cache-key';

export interface CacheInvalidateOptions {
  key?: CacheKeyOption;
  pattern?: string;
}

export function CacheInvalidate(options?: CacheInvalidateOptions): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: { cacheService?: CacheService }, ...args: unknown[]) {
      const result = await originalMethod.apply(this, args);

      const cacheService = this.cacheService;
      if (cacheService) {
        if (options?.pattern) {
          await cacheService.deleteByPattern(options.pattern);
        } else {
          const cacheKey = resolveCacheKey(options?.key, propertyKey as string, args);
          await cacheService.delete(cacheKey);
        }
      }

      return result;
    };
  };
}
