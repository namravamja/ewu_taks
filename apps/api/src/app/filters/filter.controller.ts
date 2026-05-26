import { Auditable, AuditAction } from '@mediastar/core';
import { ApiStandardErrors, ApiWrappedResponse, ErrorResponseVM } from '@mediastar/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CreateFilterDTO, FilterConfigVM, FilterMutationResultVM } from './dtos';
import { FilterService } from './filter.service';

@ApiTags('Filter')
@ApiStandardErrors()
@Controller('filter')
export class FilterController {
  constructor(private readonly filterService: FilterService) {}

  @Get()
  @ApiOperation({ summary: 'Get all filters' })
  @ApiWrappedResponse({
    description: 'Dynamic filter configuration list',
    type: FilterConfigVM,
    isArray: true,
  })
  getFilters(): Promise<FilterConfigVM[]> {
    return this.filterService.getFilters();
  }

  @Post()
  @Auditable({
    action: AuditAction.Create,
    entityType: 'filter',
    descriptionTemplate: '{actor} created filter',
    dtoClass: CreateFilterDTO,
  })
  @ApiOperation({ summary: 'Create a filter' })
  @ApiWrappedResponse({ description: 'Created filter', type: FilterMutationResultVM, status: 201 })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Filter field already exists',
    type: ErrorResponseVM,
  })
  create(@Body() dto: CreateFilterDTO): Promise<FilterMutationResultVM> {
    return this.filterService.create(dto);
  }

  

  @Delete(':id')
  @Auditable({
    action: AuditAction.Delete,
    entityType: 'filter',
    entityIdExtractor: (req: Request) => req.params['id'] as string,
    resourceNameExtractor: (req: Request) => `Filter #${req.params['id']}`,
    descriptionTemplate: '{actor} deleted {resourceName}',
  })
  @ApiOperation({ summary: 'Delete a filter' })
  @ApiWrappedResponse({ description: 'Deleted filter', type: FilterMutationResultVM })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Filter not found',
    type: ErrorResponseVM,
  })
  @ApiParam({ name: 'id', description: 'Filter ID', type: Number })
  remove(@Param('id', ParseIntPipe) id: number): Promise<FilterMutationResultVM> {
    return this.filterService.remove(id);
  }
}
