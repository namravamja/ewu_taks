import { Prisma } from '@mediastar/database';

export const CASE_ORDER_BY_FIELDS = ['created', 'priority', 'updated', 'name'] as const;

export type CaseOrderByField = (typeof CASE_ORDER_BY_FIELDS)[number];

export function buildCasesOrderBy(
  orderBy: CaseOrderByField = 'created',
  sort: Prisma.SortOrder = 'desc',
): Prisma.CaseOrderByWithRelationInput[] {
  if (orderBy === 'priority') {
    return [{ priority: sort }, { id: sort }];
  }

  if (orderBy === 'updated') {
    return [{ updatedAt: sort }, { id: sort }];
  }

  if (orderBy === 'name') {
    return [{ subjectName: sort }, { id: sort }];
  }

  return [{ createdAt: sort }, { id: sort }];
}