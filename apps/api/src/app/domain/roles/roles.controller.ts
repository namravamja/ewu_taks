import { CurrentUser, EnforceRoleEntityHierarchy, Permissions } from '@mediastar/auth';
import {
  Auditable,
  AuditAction,
  ModuleName as M,
  perm,
  PermissionAction as A,
} from '@mediastar/core';
import {
  ApiPaginatedWrappedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
  ErrorResponseVM,
  type IUserContext,
  OffsetPaginatedResultVM,
} from '@mediastar/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CreateRoleDTO,
  RoleDetailVM,
  RoleMutationResultVM,
  RolesQueryDTO,
  RoleSummaryVM,
  UpdateRoleDTO,
} from './dtos';
import { RolesService } from './roles.service';

const NOT_FOUND_DESC = 'Role not found';

@ApiTags('Roles')
@ApiStandardErrors()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('list')
  @HttpCode(HttpStatus.OK)
  @Permissions(perm(M.Roles, A.Read))
  @ApiOperation({ summary: 'List roles' })
  @ApiPaginatedWrappedResponse({ description: 'Paginated list of roles', type: RoleSummaryVM })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseVM,
  })
  findAll(@Body() query: RolesQueryDTO): Promise<OffsetPaginatedResultVM<RoleSummaryVM>> {
    return this.rolesService.findAll(query);
  }

  @Get(':id')
  @Permissions(perm(M.Roles, A.Read))
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiWrappedResponse({ description: 'Role details', type: RoleDetailVM })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: NOT_FOUND_DESC, type: ErrorResponseVM })
  findById(@Param('id', ParseIntPipe) id: number): Promise<RoleDetailVM> {
    return this.rolesService.findById(id);
  }

  @Post()
  @Permissions(perm(M.Roles, A.Admin))
  @Auditable({
    action: AuditAction.Create,
    entityType: 'role',
    descriptionTemplate: '{actor} created role',
    dtoClass: CreateRoleDTO,
  })
  @ApiOperation({ summary: 'Create a role' })
  @ApiWrappedResponse({ description: 'Created role', type: RoleMutationResultVM, status: 201 })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Role name already exists',
    type: ErrorResponseVM,
  })
  create(@Body() dto: CreateRoleDTO): Promise<RoleMutationResultVM> {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Permissions(perm(M.Roles, A.Admin))
  @EnforceRoleEntityHierarchy()
  @Auditable({
    action: AuditAction.Update,
    entityType: 'role',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `Role #${req.params['id']}`,
    descriptionTemplate: '{actor} updated {resourceName}',
    dtoClass: UpdateRoleDTO,
  })
  @ApiOperation({ summary: 'Update a role' })
  @ApiWrappedResponse({ description: 'Updated role', type: RoleMutationResultVM })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot modify a built-in role',
    type: ErrorResponseVM,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: NOT_FOUND_DESC, type: ErrorResponseVM })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Role name already exists',
    type: ErrorResponseVM,
  })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDTO,
  ): Promise<RoleMutationResultVM> {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(perm(M.Roles, A.Admin))
  @EnforceRoleEntityHierarchy()
  @Auditable({
    action: AuditAction.Delete,
    entityType: 'role',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `Role #${req.params['id']}`,
    descriptionTemplate: '{actor} deleted {resourceName}',
  })
  @ApiOperation({ summary: 'Delete a role' })
  @ApiWrappedResponse({ description: 'Deleted role', type: RoleMutationResultVM })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete a built-in role or role with assigned users',
    type: ErrorResponseVM,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: NOT_FOUND_DESC, type: ErrorResponseVM })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<RoleMutationResultVM> {
    return this.rolesService.remove(id, user.userId);
  }
}
