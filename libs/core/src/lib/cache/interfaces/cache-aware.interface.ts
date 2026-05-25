import { CacheService } from '../cache.service';

/**
 * Services using @Cacheable or @CacheInvalidate decorators must implement this interface
 * to ensure the `cacheService` property is available at runtime.
 */
export interface CacheAware {
  readonly cacheService: CacheService;
}
