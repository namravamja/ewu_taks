import { CacheService } from '@mediastar/core';
import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicatorService: HealthIndicatorService,
    private readonly cache: CacheService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check(key);

    try {
      const isUp = await this.cache.healthCheck();
      return isUp ? indicator.up() : indicator.down();
    } catch (error) {
      return indicator.down({ error: error instanceof Error ? error.message : String(error) });
    }
  }
}
