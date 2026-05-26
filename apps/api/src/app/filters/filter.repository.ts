import { DatabaseService, Prisma } from '@mediastar/database';
import { Injectable } from '@nestjs/common';

import type { ICreateFilterRequest, IFilterMutationResult } from './interfaces/filter.interface';

const FILTER_MUTATION_SELECT = {
  id: true,
  field: true,
  label: true,
  type: true,
  operators: true,
  dependencies: true,
  isMulti: true,
  isRequired: true,
  isActive: true,
  dataSource: true,
  placeholder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FilterSelect;

@Injectable()
export class FilterRepository {
  constructor(private readonly db: DatabaseService) {}

  async getFilters(): Promise<IFilterMutationResult[]> {
    return this.db.filter.findMany({
      select: FILTER_MUTATION_SELECT,
      orderBy: { createdAt: 'asc' },
    }) as Promise<IFilterMutationResult[]>;
  }

  async findById(id: number): Promise<IFilterMutationResult | null> {
    return this.db.filter.findUnique({
      where: { id },
      select: FILTER_MUTATION_SELECT,
    }) as Promise<IFilterMutationResult | null>;
  }

  async findByField(field: string): Promise<IFilterMutationResult | null> {
    return this.db.filter.findFirst({
      where: { field: { equals: field, mode: 'insensitive' } },
      select: FILTER_MUTATION_SELECT,
    }) as Promise<IFilterMutationResult | null>;
  }

  async create(params: ICreateFilterRequest): Promise<IFilterMutationResult> {
    return this.db.filter.create({
      data: {
        field: params.field,
        label: params.label,
        type: params.type,
        ...(params.operators !== undefined && {
          operators: params.operators as Prisma.InputJsonValue,
        }),
        ...(params.dependencies !== undefined && {
          dependencies: params.dependencies as Prisma.InputJsonValue,
        }),
        ...(params.isMulti !== undefined && { isMulti: params.isMulti }),
        ...(params.isRequired !== undefined && { isRequired: params.isRequired }),
        ...(params.isActive !== undefined && { isActive: params.isActive }),
        ...(params.dataSource !== undefined && { dataSource: params.dataSource }),
        ...(params.placeholder !== undefined && { placeholder: params.placeholder }),
      },
      select: FILTER_MUTATION_SELECT,
    }) as Promise<IFilterMutationResult>;
  }

  async delete(id: number): Promise<IFilterMutationResult> {
    return this.db.filter.delete({
      where: { id },
      select: FILTER_MUTATION_SELECT,
    }) as Promise<IFilterMutationResult>;
  }
}
