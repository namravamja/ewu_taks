import { CaseFilterField } from '../enums/filter-field.enum';
import { FilterOperator } from '../enums/filter-operator.enum';

export interface ICaseFilterCondition {
  field: CaseFilterField;
  operator: FilterOperator;
  value?: unknown;
  values?: unknown[];
}