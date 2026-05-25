import { AppConfigModule } from '@mediastar/core/config';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import { DatabaseModule } from '../src/lib/database.module';
import { PrismaClient } from '../src/lib/generated/prisma/client';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for seeding');
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool, { disposeExternalPool: false });
const prisma = new PrismaClient({ adapter });

const ROLES: { name: string; level: number; isBuiltIn: boolean }[] = [
  { name: 'owner', level: 100, isBuiltIn: true },
  { name: 'admin', level: 80, isBuiltIn: true },
  { name: 'manager', level: 60, isBuiltIn: true },
  { name: 'supervisor', level: 50, isBuiltIn: true },
  { name: 'employee', level: 40, isBuiltIn: true },
  { name: 'contractor', level: 40, isBuiltIn: true },
  { name: 'attorney', level: 20, isBuiltIn: true },
  { name: 'crew', level: 30, isBuiltIn: true },
  { name: 'agency', level: 30, isBuiltIn: true },
  { name: 'public_records_associate', level: 20, isBuiltIn: true },
  { name: 'moderator', level: 60, isBuiltIn: true },
  { name: 'user', level: 10, isBuiltIn: true },
];

@Module({
  imports: [AppConfigModule.forRoot(), DatabaseModule],
})
class SeedModule {}
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    bufferLogs: true,
  });
  await app.close();
  for (const { name, level, isBuiltIn } of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: { level, isBuiltIn },
      create: { name, level, isBuiltIn },
    });
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e: unknown) => {
    process.stderr.write(String(e));
    process.exit(1);
  });
