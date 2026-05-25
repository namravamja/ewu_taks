import { IsInt, IsUUID, Min } from 'class-validator';

export class DragCaseDTO {
  @IsUUID()
  caseId!: string;

  @IsInt()
  @Min(1)
  currentStageId!: number;

  @IsInt()
  @Min(1)
  newStageId!: number;
}
