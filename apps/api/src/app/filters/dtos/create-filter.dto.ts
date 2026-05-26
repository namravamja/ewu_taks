import { FilterType } from '@mediastar/database';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import type { ICreateFilterRequest } from '../interfaces/filter.interface';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateFilterDTO implements ICreateFilterRequest {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  field!: string;

  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsEnum(FilterType)
  type!: FilterType;

  @IsOptional()
  operators?: unknown;

  @IsOptional()
  dependencies?: unknown;

  @IsOptional()
  @IsBoolean()
  isMulti?: boolean;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Transform(({ value }: { value: unknown }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dataSource?: string;

  @Transform(({ value }: { value: unknown }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeholder?: string;
}
