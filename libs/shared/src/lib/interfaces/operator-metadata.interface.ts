import type { ConditionOperator } from '../enums/condition-operator.enum';
import type { OperatorValueType } from '../enums/operator-value-type.enum';

export interface IOperatorMetadata {
  readonly operator: ConditionOperator;
  readonly valueType: OperatorValueType;
}
