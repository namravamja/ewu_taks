import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  CaseSource,
  Priority,
} from '../../../../../../../ewu_task/libs/database/src/lib/generated/prisma/client';

import type { IUpdateCaseRequest } from '../interfaces/case.interface';

export class UpdateCaseDTO implements IUpdateCaseRequest {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subjectName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  incidentType?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  incidentDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caseSummary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address911?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  callTime911?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zip?: string | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  arrestDate?: Date | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  assigneeIds?: number[];

  @IsOptional()
  @IsInt()
  stageId?: number | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  casePriority?: string | null;

  @IsOptional()
  @IsEnum(CaseSource)
  caseSource?: CaseSource;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
