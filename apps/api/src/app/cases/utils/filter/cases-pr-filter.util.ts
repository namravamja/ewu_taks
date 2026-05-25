import { CaseSource, Prisma } from '@mediastar/database';

export function buildCasesPrTeamFilter(pr_team?: CaseSource[]): Prisma.CaseWhereInput | undefined {
  if (!pr_team || pr_team.length === 0) {
    return undefined;
  }

  return {
    caseSource: {
       in: [...new Set(pr_team)],
    },
  };
}