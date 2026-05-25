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
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  CaseSource,
  Priority,
  Stages,
  User,
} from '../../../../../../../ewu_task/libs/database/src/lib/generated/prisma/client';

import type { ICreateCaseRequest } from '../interfaces/case.interface';

export class CreateCaseDTO implements ICreateCaseRequest {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subjectName: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number | null;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  incidentType: string;

  @IsDate()
  @Type(() => Date)
  incidentDate: Date;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caseSummary: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address911?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  callTime911?: string | null;

  @IsString()
  @MaxLength(100)
  state: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zip: string | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  arrestDate?: Date | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  assignee: User[];

  @IsArray()
  @IsInt({ each: true })
  assigneeIds: number[];

  @IsOptional()
  @IsInt()
  stageId: number | null;

  @IsOptional()
  stage: Stages | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  casePriority: string | null;

  @IsEnum(CaseSource)
  caseSource: CaseSource;

  @IsEnum(Priority)
  priority: Priority;
}
