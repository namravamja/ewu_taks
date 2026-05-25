import {
  ApiStandardErrors,
  ApiWrappedResponse,
  ErrorResponseVM,
  type OffsetPaginatedResultVM,
} from '@mediastar/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CasesQueryDTO, CreateCaseDTO, DragCaseDTO, UpdateCaseDTO } from './dtos';
import { CasesService } from './cases.service';
import {
  ICaseDisplayProperty,
  ICaseMutationResult,
  IGroupedCasesByStage,
} from './interfaces/case.interface';

@ApiTags('Cases')
@ApiStandardErrors()
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all cases' })
  @ApiWrappedResponse({
    description: 'Paginated list of cases',
    dataSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              subjectName: { type: 'string' },
            },
            required: ['id', 'subjectName'],
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
  getAllCases(
    @Query() query: CasesQueryDTO,
  ): Promise<OffsetPaginatedResultVM<ICaseMutationResult>> {
    return this.casesService.getAllCases(query);
  }

  @Post('stage')
  @ApiOperation({ summary: 'Get cases by stage' })
  @ApiBody({ type: CasesQueryDTO })
  @ApiWrappedResponse({
    description: 'Paginated list of cases for a single stage',
    dataSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              subjectName: { type: 'string' },
            },
            required: ['id', 'subjectName'],
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
  getCasesByStage(@Body() query: CasesQueryDTO): Promise<OffsetPaginatedResultVM<ICaseMutationResult>> {
    if (query.stageId == null) {
      throw new BadRequestException('stageId is required in request body');
    }
    return this.casesService.getCasesByStage(query.stageId, query);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search cases by stage' })
  @ApiBody({
    type: CasesQueryDTO,
    examples: {
      default: {
        summary: 'Sample search request',
        value: {
          page: 1,
          limit: 10,
          search: 'rohan',
          sort: 'desc',
          displayPropertiesFilter: [
            'id',
            'subjectName',
            'caseSummary',
            'incidentType',
            'priority',
            'createdAt',
          ],
        },
      },
    },
  })
  @ApiWrappedResponse({
    description: 'Paginated list of matched cases grouped by stage',
    dataSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stageId: { type: 'number', nullable: true },
              stageTitle: { type: 'string', nullable: true },
              caseCount: { type: 'number' },
              cases: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    subjectName: { type: 'string' },
                  },
                  required: ['id', 'subjectName'],
                },
              },
            },
            required: ['stageId', 'stageTitle', 'caseCount', 'cases'],
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
  searchCases(
    @Body() query: CasesQueryDTO,
  ): Promise<
    OffsetPaginatedResultVM<IGroupedCasesByStage>
  > {
    return this.casesService.searchCases(query);
  }

  @Post('by-stages')
  @ApiOperation({ summary: 'Get cases by stages' })
  @ApiBody({
    type: CasesQueryDTO,
    examples: {
      default: {
        summary: 'Sample grouped cases request',
        value: {
          page: 1,
          limit: 10,
          sort: 'desc',
          orderBy: 'created',
          caseLimit: 5,
          stageId: 2,
          createdAtFrom: '2026-01-01T00:00:00.000Z',
          createdAtTo: '2026-01-31T23:59:59.999Z',
          caseSource: ['PR_TEAM'],
          priority: ['HIGH', 'MEDIUM'],
          assigneeIds: [3, 7],
          displayPropertiesFilter: [
            'id',
            'subjectName',
            'caseSummary',
            'incidentType',
            'stage',
            'priority',
            'createdAt',
          ],
        },
      },
    },
  })
  @ApiWrappedResponse({
    description: 'Paginated cases grouped by stages',
    dataSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stageId: { type: 'number', nullable: true },
              stageTitle: { type: 'string', nullable: true },
              caseCount: { type: 'number' },
              cases: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    subjectName: { type: 'string' },
                  },
                  required: ['id', 'subjectName'],
                },
              },
            },
            required: ['stageId', 'stageTitle', 'caseCount', 'cases'],
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
  getAllByStages(
    @Body() query: CasesQueryDTO,
  ): Promise<
    OffsetPaginatedResultVM<IGroupedCasesByStage>
  > {
    return this.casesService.getAllCasesByAllStages(query);
  }

  @Get('display-properties-filter')
  @ApiOperation({ summary: 'Get selectable case display properties' })
  @ApiWrappedResponse({
    description: 'Selectable case display properties',
    dataSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          selected: { type: 'boolean' },
        },
        required: ['key', 'label', 'selected'],
      },
    },
  })
  displayPropertiesFilter(): Promise<ICaseDisplayProperty[]> {
    return this.casesService.displayPropertiesFilter();
  }

  @Post()
  @ApiOperation({ summary: 'Create a case' })
  @ApiWrappedResponse({
    description: 'Created case',
    status: 201,
    dataSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        caseNumber: { type: 'string' },
      },
      required: ['id', 'caseNumber'],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseVM,
  })
  create(@Body() dto: CreateCaseDTO): Promise<ICaseMutationResult> {
    return this.casesService.create(dto);
  }

  @Patch('drag')
  @ApiOperation({ summary: 'Move case from current stage to a new stage (drag action)' })
  @ApiWrappedResponse({
    description: 'Moved case',
    dataSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        stageId: { type: 'number', nullable: true },
      },
      required: ['id', 'stageId'],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error or current stage mismatch',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Case or stage not found',
    type: ErrorResponseVM,
  })
  dragCase(@Body() dto: DragCaseDTO): Promise<ICaseMutationResult> {
    return this.casesService.dragCase(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a case' })
  @ApiWrappedResponse({
    description: 'Updated case',
    dataSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        subjectName: { type: 'string' },
      },
      required: ['id', 'subjectName'],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Case not found',
    type: ErrorResponseVM,
  })
  @ApiParam({ name: 'id', description: 'Case ID', type: String })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCaseDTO,
  ): Promise<ICaseMutationResult> {
    return this.casesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a case' })
  @ApiWrappedResponse({
    description: 'Deleted case',
    dataSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        subjectName: { type: 'string' },
      },
      required: ['id', 'subjectName'],
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Case not found',
    type: ErrorResponseVM,
  })
  @ApiParam({ name: 'id', description: 'Case ID', type: String })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<ICaseMutationResult> {
    return this.casesService.remove(id);
  }
}
