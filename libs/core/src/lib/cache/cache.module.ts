import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT, REDIS_SUBSCRIBER } from '../constants/index';
import { AppLoggerService } from '../logger/logger.service';
import { CacheService } from './cache.service';
import { ThrottlerRedisStorage } from './throttler-redis-storage';

interface RedisConnectionOptions {
  host: string;
  port: number;
  password: string | undefined;
  tls: Record<string, never> | undefined;
}

function readRedisConfig(configService: ConfigService): RedisConnectionOptions {
  const useTls = configService.get<boolean>('app.redis.tls', false);
  return {
    host: configService.get<string>('app.redis.host', 'localhost'),
    port: configService.get<number>('app.redis.port', 6379),
    password: configService.get<string>('app.redis.password', '') || undefined,
    tls: useTls ? {} : undefined,
  };
}

async function createRedisConnection(
  options: RedisConnectionOptions,
  logger: AppLoggerService,
  label: string,
): Promise<Redis | null> {
  const client = new Redis({
    ...options,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    logger.warn(`Redis ${label} error`, { error: err.message });
  });

  try {
    await client.connect();
    logger.log(`Redis ${label} connected`);
    return client;
  } catch (error) {
    logger.warn(
      `Redis ${label} connection failed — operating in L1-only mode: ${(error as Error).message}`,
    );
    client.disconnect();
    return null;
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (
        configService: ConfigService,
        logger: AppLoggerService,
      ): Promise<Redis | null> => {
        logger.setContext('CacheModule');
        return createRedisConnection(readRedisConfig(configService), logger, 'client');
      },
      inject: [ConfigService, AppLoggerService],
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: async (
        configService: ConfigService,
        logger: AppLoggerService,
      ): Promise<Redis | null> => {
        logger.setContext('CacheModule');
        return createRedisConnection(readRedisConfig(configService), logger, 'subscriber');
      },
      inject: [ConfigService, AppLoggerService],
    },
    CacheService,
    ThrottlerRedisStorage,
  ],
  exports: [REDIS_CLIENT, REDIS_SUBSCRIBER, CacheService, ThrottlerRedisStorage],
})
export class CacheModule {}
