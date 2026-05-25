import { PrismaClient } from './generated/prisma/client';

/**
 * Abstract token for DI injection. The actual value is the raw PrismaClient
 * WITHOUT the soft-delete extension, provided via a factory in DatabaseModule.
 *
 * Use this when you need true permanent deletion:
 *   constructor(private readonly hardDelete: HardDeleteService) {}
 *   await this.hardDelete.user.delete({ where: { id } });
 */
export abstract class HardDeleteService extends PrismaClient {}
