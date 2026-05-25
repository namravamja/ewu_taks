import { Prisma } from '@mediastar/database';
import { Priority } from '../../../../../../../../ewu_task/libs/database/src/lib/generated/prisma/client';

export function buildCasesPriorityFilter(priority?: Priority[]): Prisma.CaseWhereInput | undefined {
  if (!priority || priority.length === 0) {
    return undefined;
  }

  return {
    priority: {
      in: [...new Set(priority)],
    },
  };
}