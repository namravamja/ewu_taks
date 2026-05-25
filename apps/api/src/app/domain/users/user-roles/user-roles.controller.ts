import {
  CurrentUser,
  EnforceRoleEntityHierarchy,
  EnforceRoleHierarchy,
  Permissions,
  PreventSelfAction,
} from '@mediastar/auth';
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
  type IUserContext,
} from '@mediastar/shared';
import { Body, Controller, Get, HttpStatus, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { SyncUserRolesDTO, UserRoleVM } from './dtos';
import { UserRolesService } from './user-roles.service';

@ApiTags('Users')
@ApiStandardErrors()
@Controller('users/:id/roles')
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Get()
  @Permissions(perm(M.Users, A.Read))
  @ApiOperation({ summary: 'List roles assigned to a user' })
  @ApiWrappedResponse({ type: UserRoleVM, isArray: true, description: 'User role list' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  listRoles(@Param('id', ParseIntPipe) id: number): Promise<UserRoleVM[]> {
    return this.userRolesService.listRoles(id);
  }

  @Patch()
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
  @PreventSelfAction('id', 'Cannot modify your own role assignments')
  @Auditable({
    action: AuditAction.Update,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} updated roles for {resourceName}',
    dtoClass: SyncUserRolesDTO,
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Sync roles for a user (reconcile to desired state)' })
  @ApiWrappedResponse({ type: UserRoleVM, isArray: true, description: 'Updated role list' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or role not found',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseVM,
  })
  syncRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SyncUserRolesDTO,
    @CurrentUser() assigner: IUserContext,
  ): Promise<UserRoleVM[]> {
    return this.userRolesService.syncRoles(id, dto.roleIds, assigner);
  }
}
