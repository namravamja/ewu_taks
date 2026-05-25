import { Permissions } from '@mediastar/auth';
import {
  Auditable,
  AuditAction,
  ModuleName as M,
  perm,
  PermissionAction as A,
} from '@mediastar/core';
import {
  ApiStandardErrors,
  ApiWrappedResponse,
  ErrorResponseVM,
  OffsetPaginationDTO,
  type OffsetPaginatedResultVM,
} from '@mediastar/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CreateStageDTO } from './dtos';
import type { IStageMutationResult } from './interfaces/stage.interface';
import { StageService } from './stage.service';

@ApiTags('Stage')
@ApiStandardErrors()
@Controller('stage')
export class StageController {
  constructor(private readonly stageService: StageService) {}

  @Get()
  @Permissions(perm(M.Stages, A.Read))
  @ApiOperation({ summary: 'Get all stages' })
  @ApiWrappedResponse({
    description: 'Paginated list of stages',
    dataSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              stageTitle: { type: 'string' },
              caseCount: { type: 'number' },
            },
            required: ['id', 'stageTitle', 'caseCount'],
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
      required: ['data', 'total', 'page', 'limit', 'totalPages'],
    },
  })
  getAllStages(
    @Query() query: OffsetPaginationDTO,
  ): Promise<OffsetPaginatedResultVM<IStageMutationResult>> {
    return this.stageService.getAllStages(query);
  }

  @Post()
  @Permissions(perm(M.Stages, A.Create))
  @Auditable({
    action: AuditAction.Create,
    entityType: 'stage',
    descriptionTemplate: '{actor} created stage',
    dtoClass: CreateStageDTO,
  })
  @ApiOperation({ summary: 'Create a stage' })
  @ApiWrappedResponse({
    description: 'Created stage',
    status: 201,
    dataSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        stageTitle: { type: 'string' },
        caseCount: { type: 'number' },
      },
      required: ['id', 'stageTitle', 'caseCount'],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Stage title already exists',
    type: ErrorResponseVM,
  })
  create(@Body() dto: CreateStageDTO): Promise<IStageMutationResult> {
    return this.stageService.create(dto);
  }

  @Delete(':id')
  @Permissions(perm(M.Stages, A.Delete))
  @Auditable({
    action: AuditAction.Delete,
    entityType: 'stage',
    entityIdExtractor: (req: Request) => req.params['id'] as string,
    resourceNameExtractor: (req: Request) => `Stage #${req.params['id']}`,
    descriptionTemplate: '{actor} deleted {resourceName}',
  })
  @ApiOperation({ summary: 'Delete a stage' })
  @ApiWrappedResponse({
    description: 'Deleted stage',
    dataSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        stageTitle: { type: 'string' },
        caseCount: { type: 'number' },
      },
      required: ['id', 'stageTitle', 'caseCount'],
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Stage not found',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete a stage that still has cases assigned',
    type: ErrorResponseVM,
  })
  @ApiParam({ name: 'id', description: 'Stage ID', type: Number })
  remove(@Param('id', ParseIntPipe) id: number): Promise<IStageMutationResult> {
    return this.stageService.remove(id);
  }
}
