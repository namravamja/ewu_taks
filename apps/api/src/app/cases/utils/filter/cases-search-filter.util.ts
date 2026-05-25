import { Prisma } from '@mediastar/database';

export function buildCasesSearchFilter(search?: string): Prisma.CaseWhereInput | undefined {
  const query = search?.trim();
  if (!query) {
    return undefined;
  }

  return {
    OR: [
      {
        subjectName: {
          contains: query,
          mode: 'insensitive' as const,
        },
      },
      {
        caseSummary: {
          contains: query,
          mode: 'insensitive' as const,
        },
      },
    ],
  };
}
