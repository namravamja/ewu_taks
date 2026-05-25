import { type CasesQueryDTO } from '../dtos';
import { buildCasesAssigneeFilter } from './filter/cases-assignee-filter.util';
import { buildCasesCreatedAtFilter } from './filter/cases-created-at-filter.util';
import { buildCasesPrTeamFilter } from './filter/cases-pr-filter.util';
import { buildCasesPriorityFilter } from './filter/cases-priority-filter.util';
import { buildCasesSearchFilter } from './filter/cases-search-filter.util';

import { Prisma } from '@mediastar/database';

export function buildCasesWhere(query: CasesQueryDTO): Prisma.CaseWhereInput {
	return {
		...(query.stageId != null && { stageId: query.stageId }),
		...(buildCasesSearchFilter(query.search) ?? {}),
		...(buildCasesCreatedAtFilter(query.createdAtFrom, query.createdAtTo) ?? {}),
		...(buildCasesPriorityFilter(query.priority) ?? {}),
		...(buildCasesAssigneeFilter(query.assigneeIds) ?? {}),
		...(buildCasesPrTeamFilter(query.caseSource) ?? {}),
	};
}
