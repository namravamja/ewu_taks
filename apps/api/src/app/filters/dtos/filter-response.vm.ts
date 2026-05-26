import { FilterType } from '@mediastar/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { IFilterDataSourceResponse } from '../interfaces/filter-datasource.interface';
import type { IFilterConfigResponse, IFilterMutationResult } from '../interfaces/filter.interface';

type FilterDependencyMap = Record<string, unknown>;

const TEXT_OPERATORS = ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
const NUMBER_OPERATORS = ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'notBetween'];
const DATE_OPERATORS = ['equals', 'before', 'after', 'between', 'notBetween'];
const SELECT_OPERATORS = ['equals', 'notEquals', 'in', 'notIn'];
const MULTI_SELECT_OPERATORS = ['containsAny', 'containsAll', 'notContainsAny', 'notContainsAll'];
const BOOLEAN_OPERATORS = ['isTrue', 'isFalse'];
const RELATION_OPERATORS = ['exists', 'notExists', 'equals', 'notEquals', 'in', 'notIn'];

export function buildFilterConfigResponse(filter: {
  field: string;
  label: string;
  type: FilterType;
  operators: unknown | null;
  dependencies: unknown | null;
  isMulti: boolean;
}, dataSource: IFilterDataSourceResponse | null): IFilterConfigResponse {
  const type = resolveFilterType(filter.type, filter.isMulti);
  const operators = resolveOperators(type, filter.operators);
  const dependencies = resolveDependencies(filter.dependencies);

  return {
    field: filter.field,
    label: filter.label,
    type,
    operators,
    dependencies,
    dataSource,
  };
}

function resolveFilterType(type: FilterType, isMulti: boolean): FilterType {
  if (type === FilterType.SELECT && isMulti) {
    return FilterType.MULTI_SELECT;
  }

  return type;
}

function resolveOperators(type: FilterType, operators: unknown): string[] {
  if (Array.isArray(operators) && operators.every((operator) => typeof operator === 'string')) {
    return operators;
  }

  switch (type) {
    case FilterType.TEXT:
      return [...TEXT_OPERATORS];
    case FilterType.NUMBER:
      return [...NUMBER_OPERATORS];
    case FilterType.DATE:
      return [...DATE_OPERATORS];
    case FilterType.SELECT:
      return [...SELECT_OPERATORS];
    case FilterType.MULTI_SELECT:
      return [...MULTI_SELECT_OPERATORS];
    case FilterType.BOOLEAN:
      return [...BOOLEAN_OPERATORS];
    case FilterType.RELATION:
      return [...RELATION_OPERATORS];
    default:
      return [];
  }
}

function resolveDependencies(
  dependencies: unknown,
): FilterDependencyMap {
  if (!isPlainObject(dependencies)) {
    return {};
  }

  return JSON.parse(JSON.stringify(dependencies)) as FilterDependencyMap;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class FilterConfigVM implements IFilterConfigResponse {
  @ApiProperty({ example: 'caseSource' })
  field!: string;

  @ApiProperty({ example: 'Case source' })
  label!: string;

  @ApiProperty({ enum: FilterType, enumName: 'FilterType' })
  type!: FilterType;

  @ApiProperty({ type: [String], example: ['equals', 'in', 'notIn'] })
  operators!: string[];

  @ApiProperty({
    description: 'Dynamic filter dependencies and UI hints for the field',
    type: 'object',
    additionalProperties: true,
  })
  dependencies!: FilterDependencyMap;

  @ApiPropertyOptional({
    description: 'Optional live datasource descriptor for UI option loading',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  dataSource!: IFilterDataSourceResponse | null;
}

export class FilterMutationResultVM implements IFilterMutationResult {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'caseSource' })
  field!: string;

  @ApiProperty({ example: 'Case source' })
  label!: string;

  @ApiProperty({ enum: FilterType, enumName: 'FilterType' })
  type!: FilterType;

  @ApiPropertyOptional({
    description: 'Supported operators for this filter in JSON format',
    type: 'object',
    additionalProperties: true,
  })
  operators!: unknown | null;

  @ApiPropertyOptional({
    description: 'Filter dependencies in JSON format',
    type: 'object',
    additionalProperties: true,
  })
  dependencies!: unknown | null;

  @ApiProperty({ example: false })
  isMulti!: boolean;

  @ApiProperty({ example: false })
  isRequired!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '/api/stages' })
  dataSource!: string | null;

  @ApiPropertyOptional({ example: 'Select stage' })
  placeholder!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
