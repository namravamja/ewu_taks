import { ConditionOperator } from '../enums/condition-operator.enum';
import { OperatorValueType } from '../enums/operator-value-type.enum';

/**
 * Maps every `ConditionOperator` to its `OperatorValueType`.
 * Single source of truth — consumed by the filter metadata endpoint
 * so the frontend knows what input widget to render per operator.
 */
export const OPERATOR_VALUE_TYPE_MAP: Readonly<Record<ConditionOperator, OperatorValueType>> = {
  [ConditionOperator.EQUALS]: OperatorValueType.SINGLE,
  [ConditionOperator.NOT_EQUALS]: OperatorValueType.SINGLE,
  [ConditionOperator.CONTAINS]: OperatorValueType.SINGLE,
  [ConditionOperator.NOT_CONTAINS]: OperatorValueType.SINGLE,
  [ConditionOperator.STARTS_WITH]: OperatorValueType.SINGLE,
  [ConditionOperator.ENDS_WITH]: OperatorValueType.SINGLE,
  [ConditionOperator.GREATER_THAN]: OperatorValueType.SINGLE,
  [ConditionOperator.GREATER_THAN_OR_EQUALS]: OperatorValueType.SINGLE,
  [ConditionOperator.LESS_THAN]: OperatorValueType.SINGLE,
  [ConditionOperator.LESS_THAN_OR_EQUALS]: OperatorValueType.SINGLE,
  [ConditionOperator.BEFORE]: OperatorValueType.SINGLE,
  [ConditionOperator.AFTER]: OperatorValueType.SINGLE,
  [ConditionOperator.IN]: OperatorValueType.ARRAY,
  [ConditionOperator.NOT_IN]: OperatorValueType.ARRAY,
  [ConditionOperator.WITHIN]: OperatorValueType.RANGE,
  [ConditionOperator.IS_EMPTY]: OperatorValueType.NONE,
  [ConditionOperator.IS_NOT_EMPTY]: OperatorValueType.NONE,
};
