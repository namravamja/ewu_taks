import { Permissions } from '@mediastar/auth';
import { ModuleName as M, perm, PermissionAction as A } from '@mediastar/core';
import {
  ApiPaginatedWrappedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
  ErrorResponseVM,
  OffsetPaginatedResultVM,
} from '@mediastar/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PermissionDetailVM, PermissionsQueryDTO } from './dtos';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiStandardErrors()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post('list')
  @HttpCode(HttpStatus.OK)
  @Permissions(perm(M.Roles, A.Read))
  @ApiOperation({ summary: 'List permissions' })
  @ApiPaginatedWrappedResponse({
    description: 'Paginated list of permissions',
    type: PermissionDetailVM,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  findAll(
    @Body() query: PermissionsQueryDTO,
  ): Promise<OffsetPaginatedResultVM<PermissionDetailVM>> {
    return this.permissionsService.findAll(query);
  }

  @Get(':id')
  @Permissions(perm(M.Roles, A.Read))
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiWrappedResponse({ description: 'Permission details', type: PermissionDetailVM })
  @ApiParam({ name: 'id', description: 'Permission ID', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Permission not found',
    type: ErrorResponseVM,
  })
  findById(@Param('id', ParseIntPipe) id: number): Promise<PermissionDetailVM> {
    return this.permissionsService.findById(id);
  }
}
