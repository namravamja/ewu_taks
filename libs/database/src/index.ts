import { Prisma } from './lib/generated/prisma/client';

export * from './lib/database.module';
export * from './lib/database.service';
export * from './lib/extensions/soft-delete.extension';
export * from './lib/generated/prisma/client';
export * from './lib/hard-delete.service';
export * from './lib/seeders/rbac.seeder';
export * from './lib/seeders/seed-runner';
export * from './lib/seeders/user.seeder';
export * from './lib/utils/advisory-lock-key.util';

export type TxClient = Prisma.TransactionClient;
export const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;
