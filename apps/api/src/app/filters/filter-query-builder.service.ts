import { Injectable } from '@nestjs/common';
import { Prisma } from '@mediastar/database';

import { type CasesQueryDTO } from '../cases/dtos';
import {
  buildCasesAssigneeFilter,
  buildCasesCreatedAtFilter,
  buildCasesPrTeamFilter,
  buildCasesPriorityFilter,
  buildCasesSearchFilter,
} from '../cases/utils/filter';
import { CaseFilterField } from './enums/filter-field.enum';
import { FilterOperator } from './enums/filter-operator.enum';
import type { ICaseFilterCondition } from './interfaces/filter-condition.interface';

@Injectable()
export class FilterQueryBuilderService {
  public buildCaseWhere(query: CasesQueryDTO): Prisma.CaseWhereInput {
    const whereParts: Prisma.CaseWhereInput[] = [];

    const legacyWhere = this.buildLegacyWhere(query);
    if (Object.keys(legacyWhere).length > 0) {
      whereParts.push(legacyWhere);
    }

    const dynamicWhere = this.buildDynamicWhere(query.filters);
    if (Object.keys(dynamicWhere).length > 0) {
      whereParts.push(dynamicWhere);
    }

    if (whereParts.length === 0) {
      return {};
    }

    if (whereParts.length === 1) {
      return whereParts[0];
    }

    return { AND: whereParts };
  }

  private buildLegacyWhere(query: CasesQueryDTO): Prisma.CaseWhereInput {
    return {
      ...(query.stageId != null && { stageId: query.stageId }),
      ...(buildCasesSearchFilter(query.search) ?? {}),
      ...(buildCasesCreatedAtFilter(query.createdAtFrom, query.createdAtTo) ?? {}),
      ...(buildCasesPriorityFilter(query.priority) ?? {}),
      ...(buildCasesAssigneeFilter(query.assigneeIds) ?? {}),
      ...(buildCasesPrTeamFilter(query.caseSource) ?? {}),
    };
  }

  private buildDynamicWhere(filters?: ICaseFilterCondition[]): Prisma.CaseWhereInput {
    if (!filters || filters.length === 0) {
      return {};
    }

    const clauses = filters
      .map((filter) => this.buildCondition(filter))
      .filter((clause): clause is Prisma.CaseWhereInput => clause != null);

    if (clauses.length === 0) {
      return {};
    }

    if (clauses.length === 1) {
      return clauses[0];
    }

    return { AND: clauses };
  }

  private buildCondition(filter: ICaseFilterCondition): Prisma.CaseWhereInput | undefined {
    switch (filter.field) {
      case CaseFilterField.SUBJECT_NAME:
        return this.buildStringCondition('subjectName', filter);
      case CaseFilterField.CASE_SUMMARY:
        return this.buildNullableStringCondition('caseSummary', filter);
      case CaseFilterField.INCIDENT_TYPE:
        return this.buildStringCondition('incidentType', filter);
      case CaseFilterField.ADDRESS_911:
        return this.buildNullableStringCondition('address911', filter);
      case CaseFilterField.CALL_TIME_911:
        return this.buildNullableStringCondition('callTime911', filter);
      case CaseFilterField.STATE:
        return this.buildStringCondition('state', filter);
      case CaseFilterField.CITY:
        return this.buildStringCondition('city', filter);
      case CaseFilterField.ZIP:
        return this.buildNullableStringCondition('zip', filter);
      case CaseFilterField.AGE:
        return this.buildNumberCondition('age', filter);
      case CaseFilterField.STAGE_ID:
        return this.buildNumberCondition('stageId', filter);
      case CaseFilterField.DUE_DATE:
        return this.buildDateCondition('dueDate', filter);
      case CaseFilterField.INCIDENT_DATE:
        return this.buildDateCondition('incidentDate', filter);
      case CaseFilterField.ARREST_DATE:
        return this.buildDateCondition('arrestDate', filter);
      case CaseFilterField.CREATED_AT:
        return this.buildDateCondition('createdAt', filter);
      case CaseFilterField.UPDATED_AT:
        return this.buildDateCondition('updatedAt', filter);
      case CaseFilterField.CASE_PRIORITY:
        return this.buildStringCondition('casePriority', filter);
      case CaseFilterField.CASE_SOURCE:
        return this.buildEnumArrayCondition('caseSource', filter);
      case CaseFilterField.PRIORITY:
        return this.buildEnumArrayCondition('priority', filter);
      case CaseFilterField.ASSIGNEE_IDS:
        return this.buildAssigneeCondition(filter);
      default:
        return undefined;
    }
  }

  private buildStringCondition(
    field: 'subjectName' | 'incidentType' | 'state' | 'city' | 'casePriority',
    filter: ICaseFilterCondition,
  ): Prisma.CaseWhereInput | undefined {
    const value = this.toTrimmedString(filter.value);
    if (value === undefined && filter.operator !== FilterOperator.IS_EMPTY && filter.operator !== FilterOperator.IS_NOT_EMPTY) {
      return undefined;
    }

    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return { [field]: { equals: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.NOT_EQUALS:
        return { [field]: { not: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.CONTAINS:
        return { [field]: { contains: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.STARTS_WITH:
        return { [field]: { startsWith: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.ENDS_WITH:
        return { [field]: { endsWith: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.IS_EMPTY:
        return { OR: [{ [field]: null }, { [field]: '' }] } as Prisma.CaseWhereInput;
      case FilterOperator.IS_NOT_EMPTY:
        return { AND: [{ [field]: { not: null } }, { [field]: { not: '' } }] } as Prisma.CaseWhereInput;
      default:
        return undefined;
    }
  }

  private buildNullableStringCondition(
    field: 'caseSummary' | 'address911' | 'callTime911' | 'zip',
    filter: ICaseFilterCondition,
  ): Prisma.CaseWhereInput | undefined {
    const value = this.toTrimmedString(filter.value);
    if (value === undefined && filter.operator !== FilterOperator.IS_EMPTY && filter.operator !== FilterOperator.IS_NOT_EMPTY) {
      return undefined;
    }

    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return { [field]: { equals: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.NOT_EQUALS:
        return { [field]: { not: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.CONTAINS:
        return { [field]: { contains: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.STARTS_WITH:
        return { [field]: { startsWith: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.ENDS_WITH:
        return { [field]: { endsWith: value, mode: 'insensitive' } } as Prisma.CaseWhereInput;
      case FilterOperator.IS_EMPTY:
        return { OR: [{ [field]: null }, { [field]: '' }] } as Prisma.CaseWhereInput;
      case FilterOperator.IS_NOT_EMPTY:
        return { AND: [{ [field]: { not: null } }, { [field]: { not: '' } }] } as Prisma.CaseWhereInput;
      default:
        return undefined;
    }
  }

  private buildNumberCondition(
    field: 'age' | 'stageId',
    filter: ICaseFilterCondition,
  ): Prisma.CaseWhereInput | undefined {
    const numericValue = this.toNumber(filter.value);
    const numericValues = this.toNumberArray(filter.values);

    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return numericValue == null ? undefined : { [field]: { equals: numericValue } } as Prisma.CaseWhereInput;
      case FilterOperator.NOT_EQUALS:
        return numericValue == null ? undefined : { [field]: { not: numericValue } } as Prisma.CaseWhereInput;
      case FilterOperator.GREATER_THAN:
        return numericValue == null ? undefined : { [field]: { gt: numericValue } } as Prisma.CaseWhereInput;
      case FilterOperator.GREATER_THAN_OR_EQUAL:
        return numericValue == null ? undefined : { [field]: { gte: numericValue } } as Prisma.CaseWhereInput;
      case FilterOperator.LESS_THAN:
        return numericValue == null ? undefined : { [field]: { lt: numericValue } } as Prisma.CaseWhereInput;
      case FilterOperator.LESS_THAN_OR_EQUAL:
        return numericValue == null ? undefined : { [field]: { lte: numericValue } } as Prisma.CaseWhereInput;
      case FilterOperator.IN:
        return numericValues.length === 0 ? undefined : { [field]: { in: numericValues } } as Prisma.CaseWhereInput;
      case FilterOperator.NOT_IN:
        return numericValues.length === 0 ? undefined : { [field]: { notIn: numericValues } } as Prisma.CaseWhereInput;
      case FilterOperator.BETWEEN:
        return numericValues.length < 2 ? undefined : { [field]: { gte: numericValues[0], lte: numericValues[1] } } as Prisma.CaseWhereInput;
      case FilterOperator.NOT_BETWEEN:
        return numericValues.length < 2
          ? undefined
          : {
              OR: [
                { [field]: { lt: numericValues[0] } },
                { [field]: { gt: numericValues[1] } },
              ],
            } as Prisma.CaseWhereInput;
      default:
        return undefined;
    }
  }

  private buildDateCondition(
    field: 'incidentDate' | 'createdAt' | 'updatedAt' | 'arrestDate' | 'dueDate',
    filter: ICaseFilterCondition,
  ): Prisma.CaseWhereInput | undefined {
    const dateValue = this.toDate(filter.value);
    const dateValues = this.toDateArray(filter.values);

    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return dateValue == null ? undefined : { [field]: { equals: dateValue } } as Prisma.CaseWhereInput;
      case FilterOperator.NOT_EQUALS:
        return dateValue == null ? undefined : { [field]: { not: dateValue } } as Prisma.CaseWhereInput;
      case FilterOperator.GREATER_THAN:
        return dateValue == null ? undefined : { [field]: { gt: dateValue } } as Prisma.CaseWhereInput;
      case FilterOperator.GREATER_THAN_OR_EQUAL:
        return dateValue == null ? undefined : { [field]: { gte: dateValue } } as Prisma.CaseWhereInput;
      case FilterOperator.LESS_THAN:
        return dateValue == null ? undefined : { [field]: { lt: dateValue } } as Prisma.CaseWhereInput;
      case FilterOperator.LESS_THAN_OR_EQUAL:
        return dateValue == null ? undefined : { [field]: { lte: dateValue } } as Prisma.CaseWhereInput;
      case FilterOperator.BETWEEN:
        return dateValues.length < 2 ? undefined : { [field]: { gte: dateValues[0], lte: dateValues[1] } } as Prisma.CaseWhereInput;
      case FilterOperator.NOT_BETWEEN:
        return dateValues.length < 2
          ? undefined
          : {
              OR: [
                { [field]: { lt: dateValues[0] } },
                { [field]: { gt: dateValues[1] } },
              ],
            } as Prisma.CaseWhereInput;
      case FilterOperator.IS_EMPTY:
        return { [field]: null } as Prisma.CaseWhereInput;
      case FilterOperator.IS_NOT_EMPTY:
        return { [field]: { not: null } } as Prisma.CaseWhereInput;
      default:
        return undefined;
    }
  }

  private buildEnumArrayCondition(
    field: 'caseSource' | 'priority',
    filter: ICaseFilterCondition,
  ): Prisma.CaseWhereInput | undefined {
    const values = this.toStringArray(filter.values ?? filter.value);
    if (values.length === 0) {
      return undefined;
    }

    if (filter.operator === FilterOperator.NOT_IN) {
      return { [field]: { notIn: values } } as Prisma.CaseWhereInput;
    }

    return { [field]: { in: values } } as Prisma.CaseWhereInput;
  }

  private buildAssigneeCondition(filter: ICaseFilterCondition): Prisma.CaseWhereInput | undefined {
    const values = this.toNumberArray(filter.values ?? filter.value);
    if (values.length === 0) {
      return undefined;
    }

    switch (filter.operator) {
      case FilterOperator.EXISTS:
        return { assignee: { some: {} } };
      case FilterOperator.NOT_EXISTS:
        return { assignee: { none: {} } };
      case FilterOperator.NOT_IN:
        return { assignee: { none: { id: { in: values } } } };
      case FilterOperator.CONTAINS_ALL:
        return { AND: values.map((assigneeId) => ({ assignee: { some: { id: assigneeId } } })) };
      case FilterOperator.NOT_CONTAINS_ALL:
        return { OR: values.map((assigneeId) => ({ assignee: { none: { id: assigneeId } } })) };
      case FilterOperator.CONTAINS_ANY:
      case FilterOperator.IN:
      default:
        return { assignee: { some: { id: { in: values } } } };
    }
  }

  private toTrimmedString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      const singleValue = this.toTrimmedString(value);
      return singleValue ? [singleValue] : [];
    }

    return value.map((item) => this.toTrimmedString(item)).filter((item): item is string => item != null);
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private toNumberArray(values: unknown): number[] {
    const source = Array.isArray(values) ? values : [values];
    return source.map((value) => this.toNumber(value)).filter((value): value is number => value != null);
  }

  private toDate(value: unknown): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
  }

  private toDateArray(values: unknown): Date[] {
    const source = Array.isArray(values) ? values : [values];
    return source.map((value) => this.toDate(value)).filter((value): value is Date => value != null);
  }
}