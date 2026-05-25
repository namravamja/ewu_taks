import { ApiProperty } from '@nestjs/swagger';

import { ConditionOperator } from '../enums/condition-operator.enum';
import { OperatorValueType } from '../enums/operator-value-type.enum';
import type { IOperatorMetadata } from '../interfaces/operator-metadata.interface';

export class OperatorMetadataDto implements IOperatorMetadata {
  @ApiProperty({
    description: 'Condition operator',
    enum: ConditionOperator,
    enumName: 'ConditionOperator',
    example: ConditionOperator.EQUALS,
  })
  readonly operator!: ConditionOperator;

  @ApiProperty({
    description: 'Type of value the frontend should collect for this operator',
    enum: OperatorValueType,
    enumName: 'OperatorValueType',
    example: OperatorValueType.SINGLE,
  })
  readonly valueType!: OperatorValueType;
}
