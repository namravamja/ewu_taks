import { buildListQuery, buildPaginatedResult, OffsetPaginatedResultVM } from '@mediastar/shared';
import { Injectable, NotFoundException } from '@nestjs/common';

import {
  PERMISSION_SEARCHABLE_FIELDS,
  PERMISSION_SORTABLE_FIELDS,
  PermissionDetailVM,
  PermissionsQueryDTO,
} from './dtos';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async findByIds(ids: number[]): Promise<Array<{ id: number }>> {
    return this.permissionsRepository.findByIds(ids);
  }

  async findAll(query: PermissionsQueryDTO): Promise<OffsetPaginatedResultVM<PermissionDetailVM>> {
    const { skip, take, orderBy, searchWhere } = buildListQuery(
      query,
      PERMISSION_SEARCHABLE_FIELDS,
      PERMISSION_SORTABLE_FIELDS,
      'module',
    );

    const where = {
      ...searchWhere,
      ...(query.module != null && { module: query.module }),
    };

    const [data, total] = await this.permissionsRepository.findMany({
      skip,
      take,
      where,
      orderBy,
    });

    return buildPaginatedResult(data, total, query);
  }

  async findById(id: number): Promise<PermissionDetailVM> {
    const permission = await this.permissionsRepository.findById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }
}
