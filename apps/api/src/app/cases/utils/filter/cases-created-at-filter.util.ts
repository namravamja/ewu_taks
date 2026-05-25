import { Prisma } from '@mediastar/database';

export function buildCasesCreatedAtFilter(
  createdAtFrom?: Date,
  createdAtTo?: Date,
): Prisma.CaseWhereInput | undefined {
  if (!createdAtFrom && !createdAtTo) {
    return undefined;
  }

  return {
    createdAt: {
      ...(createdAtFrom && { gte: createdAtFrom }),
      ...(createdAtTo && { lte: createdAtTo }),
    },
  };
}