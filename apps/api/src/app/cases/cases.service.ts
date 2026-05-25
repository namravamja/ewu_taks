import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginatedResult, type OffsetPaginatedResultVM } from '@mediastar/shared';

import { CaseRepository } from './cases.repository';
import {
  ICaseDisplayProperty,
  ICaseMutationResult,
  IGroupedCasesByStage,
} from './interfaces/case.interface';
import { CasesQueryDTO, CreateCaseDTO, DragCaseDTO, UpdateCaseDTO } from './dtos';

const CASE_NOT_FOUND = 'Case not found';

@Injectable()
export class CasesService {
  constructor(private readonly caseRepository: CaseRepository) {}

  async getAllCases(
    query: CasesQueryDTO,
  ): Promise<OffsetPaginatedResultVM<ICaseMutationResult>> {
    const [data, total] = await this.caseRepository.findMany(query);
    return buildPaginatedResult(data, total, query);
  }

  async getCasesByStage(
    stageId: number,
    query: CasesQueryDTO,
  ): Promise<OffsetPaginatedResultVM<ICaseMutationResult>> {
    const [data, total] = await this.caseRepository.findMany({
      ...query,
      stageId,
    });

    return buildPaginatedResult(data, total, query);
  }

  async searchCases(
    query: CasesQueryDTO,
  ): Promise<OffsetPaginatedResultVM<IGroupedCasesByStage>> {
    return this.getAllCasesByAllStages(query);
  }

  async getAllCasesByAllStages(
    query: CasesQueryDTO,
  ): Promise<
    OffsetPaginatedResultVM<IGroupedCasesByStage>
  > {
    const [data, total] = await this.caseRepository.getAllCasesByAllStages(query);
    return buildPaginatedResult(data, total, query);
  }

  async displayPropertiesFilter(): Promise<ICaseDisplayProperty[]> {
    return this.caseRepository.displayPropertiesFilter();
  }

  async create(dto: CreateCaseDTO): Promise<ICaseMutationResult> {
    return this.caseRepository.create(dto);
  }

  async dragCase(dto: DragCaseDTO): Promise<ICaseMutationResult> {
    const existing = await this.caseRepository.findById(dto.caseId);
    if (!existing) {
      throw new NotFoundException(CASE_NOT_FOUND);
    }

    if (existing.stageId !== dto.currentStageId) {
      throw new BadRequestException('Current stage does not match the case stage');
    }

    const stageExists = await this.caseRepository.stageExists(dto.newStageId);
    if (!stageExists) {
      throw new NotFoundException('Stage not found');
    }

    return this.caseRepository.moveCaseToStage(dto.caseId, dto.newStageId);
  }

  async update(id: string, dto: UpdateCaseDTO): Promise<ICaseMutationResult> {
    const existing = await this.caseRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(CASE_NOT_FOUND);
    }

    return this.caseRepository.update(id, dto);
  }

  async remove(id: string): Promise<ICaseMutationResult> {
    const existing = await this.caseRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(CASE_NOT_FOUND);
    }

    await this.caseRepository.delete(id);
    return existing;
  }
}
