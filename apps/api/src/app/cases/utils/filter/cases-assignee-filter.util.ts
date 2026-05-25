import { Prisma } from '@mediastar/database';

export function buildCasesAssigneeFilter(assigneeIds?: number[]): Prisma.CaseWhereInput | undefined {
  if (!assigneeIds || assigneeIds.length === 0) {
    return undefined;
  }

  return {
    assignee: {
      some: {
        id: {
          in: [...new Set(assigneeIds)],
        },
      },
    },
  };
}