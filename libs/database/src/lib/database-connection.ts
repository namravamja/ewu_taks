import { AppLoggerService } from '@mediastar/core';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import { PrismaClient } from './generated/prisma/client';

@Injectable()
export class DatabaseConnection extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(
    configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    const connectionString = configService.getOrThrow<string>('app.database.url');

    const max = configService.getOrThrow<number>('app.database.pool.max');
    const idleTimeoutMillis = configService.getOrThrow<number>(
      'app.database.pool.idleTimeoutMillis',
    );
    const connectionTimeoutMillis = configService.getOrThrow<number>(
      'app.database.pool.connectionTimeoutMillis',
    );

    const txMaxWait = configService.getOrThrow<number>('app.database.transaction.maxWait');
    const txTimeout = configService.getOrThrow<number>('app.database.transaction.timeout');

    const pool = new pg.Pool({
      connectionString,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    });

    pool.on('error', (err) => {
      this.logger.error('Unexpected idle client error', err);
    });

    const adapter = new PrismaPg(pool, { disposeExternalPool: false });

    super({
      adapter,
      transactionOptions: {
        maxWait: txMaxWait,
        timeout: txTimeout,
      },
    });

    this.logger.setContext(DatabaseConnection.name);
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();

    this.logger.info('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } finally {
      try {
        await this.pool.end();
      } catch (err) {
        this.logger.error('Failed to close connection pool', err as Error);
      }
    }
  }
}
