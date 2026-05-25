import { DatabaseService, Prisma } from '@mediastar/database';
import { Injectable } from '@nestjs/common';
import { buildPaginationArgs, type OffsetPaginationDTO } from '@mediastar/shared';

import type { IStageMutationResult } from './interfaces/stage.interface';

const STAGE_MUTATION_SELECT = {
  id: true,
  stageTitle: true,
  caseCount: true,
} satisfies Prisma.StagesSelect;

interface CreateStageParams {
  stageTitle: string;
}

@Injectable()
export class StageRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(query: OffsetPaginationDTO): Promise<[IStageMutationResult[], number]> {
    const { skip, take } = buildPaginationArgs(query);

    const [data, total] = await Promise.all([
      this.db.stages.findMany({
        select: STAGE_MUTATION_SELECT,
        skip,
        take,
        orderBy: { id: query.sort ?? 'desc' },
      }),
      this.db.stages.count(),
    ]);

    return [data as IStageMutationResult[], total];
  }

  async findById(id: number): Promise<IStageMutationResult | null> {
    return this.db.stages.findUnique({
      where: { id },
      select: STAGE_MUTATION_SELECT,
    }) as Promise<IStageMutationResult | null>;
  }

  async findByTitle(stageTitle: string): Promise<IStageMutationResult | null> {
    return this.db.stages.findFirst({
      where: { stageTitle: { equals: stageTitle, mode: 'insensitive' } },
      select: STAGE_MUTATION_SELECT,
    }) as Promise<IStageMutationResult | null>;
  }

  async countCasesByStageId(stageId: number): Promise<number> {
    return this.db.case.count({ where: { stageId } });
  }

  async create(params: CreateStageParams): Promise<IStageMutationResult> {
    return this.db.stages.create({
      data: { stageTitle: params.stageTitle },
      select: STAGE_MUTATION_SELECT,
    }) as Promise<IStageMutationResult>;
  }

  async delete(id: number): Promise<IStageMutationResult> {
    return this.db.stages.delete({
      where: { id },
      select: STAGE_MUTATION_SELECT,
    }) as Promise<IStageMutationResult>;
  }
}
