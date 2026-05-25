import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseService } from './database.service';
import { DatabaseConnection } from './database-connection';
import { withSoftDelete } from './extensions/soft-delete.extension';
import { HardDeleteService } from './hard-delete.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseConnection,
    {
      provide: DatabaseService,
      // Note: $disconnect() on the extended client does NOT close the pg.Pool.
      // Pool cleanup is handled by DatabaseConnection.onModuleDestroy().
      // In integration tests, use app.close() (not db.$disconnect()) to ensure
      // NestJS lifecycle hooks run and the pool is properly drained.
      // Prisma's $extends uses Object.create(originalClient) internally, so the
      // extended client inherits onModuleInit/onModuleDestroy from DatabaseConnection
      // via the prototype chain. Shadowing them here prevents NestJS from calling
      // these lifecycle hooks twice (once on DatabaseConnection, once on this client).
      useFactory: (conn: DatabaseConnection): DatabaseService => {
        const db = withSoftDelete(conn) as unknown as Record<string, unknown>;
        db['onModuleInit'] = undefined;
        db['onModuleDestroy'] = undefined;
        return db as unknown as DatabaseService;
      },
      inject: [DatabaseConnection],
    },
    {
      provide: HardDeleteService,
      useExisting: DatabaseConnection,
    },
  ],
  exports: [DatabaseService, HardDeleteService],
})
export class DatabaseModule {}
