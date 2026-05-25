export enum OperatorValueType {
  /** Single scalar value — text, number, boolean, or date input */
  SINGLE = 'SINGLE',
  /** Array of values — multi-select / tag input (IN, NOT_IN) */
  ARRAY = 'ARRAY',
  /** Two-value range — date range picker (WITHIN) */
  RANGE = 'RANGE',
  /** No value needed — presence check only (IS_EMPTY, IS_NOT_EMPTY) */
  NONE = 'NONE',
}
