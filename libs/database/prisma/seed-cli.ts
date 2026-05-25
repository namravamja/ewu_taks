import 'reflect-metadata';

import { LoggerModule } from '@mediastar/core';
import { AppConfigModule } from '@mediastar/core/config';
import {
  DatabaseModule,
  HardDeleteService,
  RbacSeeder,
  SeedRunner,
  UserSeeder,
} from '@mediastar/database';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

@Module({
  imports: [AppConfigModule.forRoot(), LoggerModule.forRoot(), DatabaseModule],
  providers: [
    RbacSeeder,
    UserSeeder,
    {
      provide: SeedRunner,
      useFactory: (
        hardDelete: HardDeleteService,
        rbacSeeder: RbacSeeder,
        userSeeder: UserSeeder,
        config: ConfigService,
      ): SeedRunner => new SeedRunner(hardDelete, rbacSeeder, userSeeder, config),
      inject: [HardDeleteService, RbacSeeder, UserSeeder, ConfigService],
    },
  ],
})
class SeedModule {}

const logger = new Logger('SeedCLI');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule);

  try {
    const seedRunner = app.get(SeedRunner);
    await seedRunner.runSeeders();
    logger.log('All seeders completed successfully');
  } finally {
    await app.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e: unknown) => {
    logger.error('Seeding failed', e instanceof Error ? e.stack : String(e));
    process.exit(1);
  });
