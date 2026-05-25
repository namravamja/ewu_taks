import { THROTTLE_TIER_DEFAULTS, ThrottlerRedisStorage } from '@mediastar/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppThrottlerGuard } from './app-throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, ThrottlerRedisStorage],
      useFactory: (config: ConfigService, storage: ThrottlerRedisStorage) => ({
        storage,
        throttlers: Object.entries(THROTTLE_TIER_DEFAULTS).map(([name, defaults]) => ({
          name,
          limit: config.get<number>(`app.rateLimit.${name}.limit`, defaults.limit),
          ttl: config.get<number>(`app.rateLimit.${name}.ttl`, defaults.ttl),
        })),
      }),
    }),
  ],
  providers: [AppThrottlerGuard],
  exports: [AppThrottlerGuard],
})
export class ThrottlerConfigModule {}
