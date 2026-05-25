import { Prisma, PrismaClient } from './generated/prisma/client';

// Derives soft-delete model keys from Prisma TypeMap — no hardcoded list.
type SoftDeleteModelKey = {
  [M in keyof Prisma.TypeMap['model']]: 'isDeleted' extends keyof Prisma.TypeMap['model'][M]['fields']
    ? Uncapitalize<M & string> & keyof PrismaClient
    : never;
}[keyof Prisma.TypeMap['model']];

type ModelOps<K extends SoftDeleteModelKey> = Prisma.TypeMap['model'][Capitalize<K> &
  keyof Prisma.TypeMap['model']]['operations'];

// Augments delete/deleteMany to require `deletedBy` on soft-delete models.
type WithDeletedBy<T, K extends SoftDeleteModelKey> = Omit<T, 'delete' | 'deleteMany'> & {
  delete(args: ModelOps<K>['delete']['args'] & { deletedBy: number }): Promise<unknown>;
  deleteMany(args: ModelOps<K>['deleteMany']['args'] & { deletedBy: number }): Promise<unknown>;
};

type SoftDeleteDelegates = {
  [K in SoftDeleteModelKey]: WithDeletedBy<PrismaClient[K], K>;
};

/**
 * DI token + type for the soft-delete-extended PrismaClient.
 *
 * Usage:
 *   constructor(private readonly db: DatabaseService) {}
 *
 *   await this.db.user.delete({ where: { id }, deletedBy });
 *   await this.db.role.delete({ where: { name: 'old' }, deletedBy });
 */
abstract class BaseDatabaseService extends PrismaClient {}

export type DatabaseService = BaseDatabaseService & SoftDeleteDelegates;

export const DatabaseService = BaseDatabaseService as abstract new (
  ...args: ConstructorParameters<typeof PrismaClient>
) => DatabaseService;

// NestJS reads .name for DI error messages — keep it matching the public export name.
Object.defineProperty(DatabaseService, 'name', { value: 'DatabaseService' });
