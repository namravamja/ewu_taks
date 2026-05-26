import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';

import { CaseFilterField } from '../enums/filter-field.enum';
import { FilterOperator } from '../enums/filter-operator.enum';
import type { ICaseFilterCondition } from '../interfaces/filter-condition.interface';

export class FilterConditionDTO implements ICaseFilterCondition {
  @ApiProperty({ enum: CaseFilterField, enumName: 'CaseFilterField' })
  @IsEnum(CaseFilterField)
  field!: CaseFilterField;

  @ApiProperty({ enum: FilterOperator, enumName: 'FilterOperator' })
  @IsEnum(FilterOperator)
  operator!: FilterOperator;

  @ApiPropertyOptional({ description: 'Single value for the filter condition' })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({ description: 'Multiple values for the filter condition', type: [Object] })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  values?: unknown[];
}