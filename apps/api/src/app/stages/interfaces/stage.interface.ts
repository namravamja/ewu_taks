export interface ICreateStageRequest {
  stageTitle: string;
}

export interface IStageMutationResult {
  id: number;
  stageTitle: string;
  caseCount: number;
}
