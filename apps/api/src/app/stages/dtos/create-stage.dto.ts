import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import type { ICreateStageRequest } from '../interfaces/stage.interface';

export class CreateStageDTO implements ICreateStageRequest {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  stageTitle!: string;
}
