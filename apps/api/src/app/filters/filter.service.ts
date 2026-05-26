import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { CreateFilterDTO, buildFilterConfigResponse } from './dtos';
import type { IFilterConfigResponse, IFilterMutationResult } from './interfaces/filter.interface';
import { FilterRepository } from './filter.repository';

const FILTER_NOT_FOUND = 'Filter not found';

@Injectable()
export class FilterService {
  constructor(private readonly filterRepository: FilterRepository) {}

  async getFilters(): Promise<IFilterConfigResponse[]> {
    const filters = await this.filterRepository.getFilters();

    return filters.map((filter) => buildFilterConfigResponse(filter));
  }

  async create(dto: CreateFilterDTO): Promise<IFilterMutationResult> {
    const existing = await this.filterRepository.findByField(dto.field);
    if (existing) {
      throw new ConflictException(`Filter with field "${dto.field}" already exists`);
    }

    return this.filterRepository.create(dto);
  }

  async remove(id: number): Promise<IFilterMutationResult> {
    const filter = await this.filterRepository.findById(id);
    if (!filter) {
      throw new NotFoundException(FILTER_NOT_FOUND);
    }

    await this.filterRepository.delete(id);
    return filter;
  }
}
