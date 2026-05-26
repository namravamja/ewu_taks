import { FilterType } from '@mediastar/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { IFilterConfigResponse, IFilterMutationResult } from '../interfaces/filter.interface';

type FilterDependencyMap = Record<string, unknown>;

const TEXT_OPERATORS = ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
const NUMBER_OPERATORS = ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'notBetween'];
const DATE_OPERATORS = ['equals', 'before', 'after', 'between', 'notBetween'];
const SELECT_OPERATORS = ['equals', 'notEquals', 'in', 'notIn'];
const MULTI_SELECT_OPERATORS = ['containsAny', 'containsAll', 'notContainsAny', 'notContainsAll'];
const BOOLEAN_OPERATORS = ['isTrue', 'isFalse'];
const RELATION_OPERATORS = ['exists', 'notExists', 'equals', 'notEquals', 'in', 'notIn'];

const TEXT_DEPENDENCIES: FilterDependencyMap = {
  ranges: false,
  presets: ['contains', 'startsWith', 'endsWith'],
  within: true,
};

const NUMBER_DEPENDENCIES: FilterDependencyMap = {
  ranges: true,
  presets: ['equals', 'between', 'greaterThan', 'lessThan'],
  min: null,
  max: null,
};

const DATE_DEPENDENCIES: FilterDependencyMap = {
  ranges: true,
  presets: ['today', 'yesterday', 'thisWeek', 'thisMonth', 'last7Days'],
  beforeAfter: true,
  within: true,
};

const SELECT_DEPENDENCIES: FilterDependencyMap = {
  options: [],
  enumOptions: true,
  liveDataSource: null,
  multiSelect: false,
};

const MULTI_SELECT_DEPENDENCIES: FilterDependencyMap = {
  options: [],
  enumOptions: true,
  liveDataSource: null,
  multiSelect: true,
};

const BOOLEAN_DEPENDENCIES: FilterDependencyMap = {
  options: [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ],
};

const RELATION_DEPENDENCIES: FilterDependencyMap = {
  liveDataSource: null,
  relation: true,
  multiSelect: true,
};

function cloneDependencies(base: FilterDependencyMap): FilterDependencyMap {
  return JSON.parse(JSON.stringify(base)) as FilterDependencyMap;
}

export function buildFilterConfigResponse(filter: {
  field: string;
  label: string;
  type: FilterType;
  operators: unknown | null;
  dependencies: unknown | null;
  isMulti: boolean;
  dataSource: string | null;
}): IFilterConfigResponse {
  const type = resolveFilterType(filter.type, filter.isMulti);
  const operators = resolveOperators(type, filter.operators);
  const dependencies = resolveDependencies(type, filter.dependencies, filter.dataSource, filter.isMulti);

  return {
    field: filter.field,
    label: filter.label,
    type,
    operators,
    dependencies,
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
  type: FilterType,
  dependencies: unknown,
  dataSource: string | null,
  isMulti: boolean,
): FilterDependencyMap {
  const resolved = cloneDependencies(getDependencyTemplate(type));

  if (isPlainObject(dependencies)) {
    Object.assign(resolved, dependencies);
  }

  if (dataSource) {
    resolved['liveDataSource'] = dataSource;
  }

  if (type === FilterType.SELECT || type === FilterType.MULTI_SELECT || type === FilterType.RELATION) {
    resolved['multiSelect'] = isMulti || type === FilterType.MULTI_SELECT || type === FilterType.RELATION;
  }

  return resolved;
}

function getDependencyTemplate(type: FilterType): FilterDependencyMap {
  switch (type) {
    case FilterType.TEXT:
      return TEXT_DEPENDENCIES;
    case FilterType.NUMBER:
      return NUMBER_DEPENDENCIES;
    case FilterType.DATE:
      return DATE_DEPENDENCIES;
    case FilterType.SELECT:
      return SELECT_DEPENDENCIES;
    case FilterType.MULTI_SELECT:
      return MULTI_SELECT_DEPENDENCIES;
    case FilterType.BOOLEAN:
      return BOOLEAN_DEPENDENCIES;
    case FilterType.RELATION:
      return RELATION_DEPENDENCIES;
    default:
      return {};
  }
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
