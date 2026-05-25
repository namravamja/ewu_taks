import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'libs/database/prisma/schema.prisma',
  migrations: {
    path: 'libs/database/prisma/migrations',
    seed: 'pnpm exec tsx libs/database/prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
});
