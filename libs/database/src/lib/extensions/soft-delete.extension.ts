import { Prisma, PrismaClient } from '../generated/prisma/client';

// Auto-detect soft-delete models: any model with isDeleted + deletedAt + deletedBy fields.
const SOFT_DELETE_FIELDS = ['isDeleted', 'deletedAt', 'deletedBy'] as const;

const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set(
  Object.values(Prisma.ModelName).filter((modelName) => {
    const enumKey = `${modelName}ScalarFieldEnum`;
    const fieldEnum = Object.getOwnPropertyDescriptor(Prisma, enumKey)?.value as
      | Record<string, string>
      | undefined;
    if (!fieldEnum) return false;
    return SOFT_DELETE_FIELDS.every((f) => f in fieldEnum);
  }),
);

function isSoftDeleteModel(model: string | undefined): model is string {
  return model !== undefined && SOFT_DELETE_MODELS.has(model);
}

/**
 * Sentinel value for the `isDeleted` escape hatch. Pass as
 * `where: { isDeleted: INCLUDE_SOFT_DELETED }` to bypass the soft-delete
 * extension and match **both** deleted and non-deleted records.
 *
 * The extension strips the sentinel before the query reaches Prisma, so
 * no `isDeleted` filter is applied at all.
 *
 * @example
 * ```ts
 * import { INCLUDE_SOFT_DELETED } from '@mediastar/database';
 *
 * await db.user.findMany({
 *   where: { status: 'ACTIVE', isDeleted: INCLUDE_SOFT_DELETED as never },
 * });
 * ```
 */
export const INCLUDE_SOFT_DELETED: unique symbol = Symbol('INCLUDE_SOFT_DELETED');

interface SoftDeleteWhere {
  where?: Record<string, unknown>;
}

/**
 * If `isDeleted` is the sentinel symbol, strip it from `where` so Prisma
 * receives no `isDeleted` filter at all — matching both deleted and non-deleted rows.
 */
function stripSentinel(where: Record<string, unknown>): Record<string, unknown> {
  if (where['isDeleted'] === INCLUDE_SOFT_DELETED) {
    const filtered = { ...where };
    delete filtered['isDeleted'];
    return filtered;
  }
  return where;
}

/**
 * Adds `isDeleted: false` directly to `where`.
 * Used by: findFirst, findMany, count, aggregate, groupBy, updateMany.
 *
 * Escape hatches:
 * - `{ isDeleted: true }` — query only deleted records
 * - `{ isDeleted: INCLUDE_SOFT_DELETED }` — query both deleted and non-deleted
 */
function injectSoftDeleteFilter(args: SoftDeleteWhere): SoftDeleteWhere {
  const where = args.where ?? {};

  const hasExplicit =
    Object.prototype.hasOwnProperty.call(where, 'isDeleted') &&
    where['isDeleted'] !== undefined &&
    where['isDeleted'] !== null;

  if (hasExplicit) {
    return { ...args, where: stripSentinel(where) };
  }

  return { ...args, where: { ...where, isDeleted: false } };
}

/**
 * Adds `isDeleted: false` via an AND clause instead of directly in `where`.
 * Required for findUnique/upsert/update where `where` only accepts unique-constraint fields.
 */
function injectSoftDeleteFilterViaAnd(args: SoftDeleteWhere): SoftDeleteWhere {
  const where = args.where ?? {};

  const hasExplicit =
    Object.prototype.hasOwnProperty.call(where, 'isDeleted') &&
    where['isDeleted'] !== undefined &&
    where['isDeleted'] !== null;

  if (hasExplicit) {
    return { ...args, where: stripSentinel(where) };
  }

  // Prisma accepts AND as a single object or array — normalize to array.
  const existingAnd = where['AND'];
  let andClauses: Record<string, unknown>[];
  if (Array.isArray(existingAnd)) {
    andClauses = [...existingAnd];
  } else if (existingAnd != null) {
    andClauses = [existingAnd as Record<string, unknown>];
  } else {
    andClauses = [];
  }

  andClauses.push({ isDeleted: false });

  return { ...args, where: { ...where, AND: andClauses } };
}

interface QueryParam {
  model: string | undefined;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

interface DeleteArgs {
  where: unknown;
  deletedBy?: number;
}

interface SoftDeleteDelegate {
  update(args: { where: unknown; data: unknown }): Promise<unknown>;
  updateMany(args: { where: unknown; data: unknown }): Promise<unknown>;
}

type DelegateResolver = (model: string) => SoftDeleteDelegate;

type QueryOperationHandler = (params: QueryParam) => Promise<unknown>;

type SoftDeleteQueryConfig = {
  $allModels: Record<string, QueryOperationHandler>;
};

function buildSoftDeleteQueryConfig(getDelegate: DelegateResolver): SoftDeleteQueryConfig {
  return {
    $allModels: {
      async findFirst({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilter(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async findFirstOrThrow({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilter(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async findMany({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilter(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async findUnique({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilterViaAnd(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async findUniqueOrThrow({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilterViaAnd(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async count({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilter(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async aggregate({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilter(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async groupBy({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilter(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      // Soft-deleted records are invisible to upsert — it creates a new record
      // rather than un-deleting. To un-delete, use update() with { isDeleted: true } escape hatch.
      async upsert({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilterViaAnd(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async update({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilterViaAnd(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      async updateMany({ model, args, query }: QueryParam) {
        const filtered = isSoftDeleteModel(model)
          ? injectSoftDeleteFilter(args as SoftDeleteWhere)
          : args;
        return query(filtered);
      },

      // Converts delete() → update() with soft-delete fields.
      // Uses a closure-based delegate resolver instead of Prisma.getExtensionContext(this),
      // which does not return a usable model delegate in Prisma 7.
      // The resulting update() will also pass through the update interceptor above,
      // which adds a redundant-but-harmless isDeleted AND clause.
      async delete({ model, args, query }: QueryParam) {
        if (!isSoftDeleteModel(model)) return query(args);
        const { deletedBy, where } = args as DeleteArgs;
        if (deletedBy == null) {
          throw new Error(
            `delete() on soft-delete model "${model}" requires "deletedBy". ` +
              'Usage: db.user.delete({ where: { id }, deletedBy: userId })',
          );
        }
        return getDelegate(model).update({
          where: { ...(where as Record<string, unknown>), isDeleted: false },
          data: { isDeleted: true, deletedAt: new Date(), deletedBy },
        });
      },

      async deleteMany({ model, args, query }: QueryParam) {
        if (!isSoftDeleteModel(model)) return query(args);
        const { deletedBy, where } = args as DeleteArgs;
        if (deletedBy == null) {
          throw new Error(
            `deleteMany() on soft-delete model "${model}" requires "deletedBy". ` +
              'Usage: db.user.deleteMany({ where: { ... }, deletedBy: userId })',
          );
        }
        return getDelegate(model).updateMany({
          where: { ...(where as Record<string, unknown>), isDeleted: false },
          data: { isDeleted: true, deletedAt: new Date(), deletedBy },
        });
      },
    },
  };
}

export function withSoftDelete(client: PrismaClient): PrismaClient {
  // Mutable holder for the extended client reference. delete/deleteMany handlers
  // use this to call .update() on the correct model delegate. Assigned after $extends returns.
  const ref: { current: Record<string, unknown> } = {
    current: {} as Record<string, unknown>,
  };

  const resolveDelegate: DelegateResolver = (model: string) => {
    const key = model.charAt(0).toLowerCase() + model.slice(1);
    return Reflect.get(ref.current, key) as SoftDeleteDelegate;
  };

  const extended = client.$extends({
    name: 'softDelete',
    query: buildSoftDeleteQueryConfig(resolveDelegate),
  }) as unknown as PrismaClient;

  ref.current = extended as unknown as Record<string, unknown>;
  return extended;
}
