import {
  CurrentUser,
  EnforceRoleEntityHierarchy,
  EnforceRoleHierarchy,
  Permissions,
  PreventSelfAction,
  Public,
  VALIDATION_ERROR_DESC,
} from '@mediastar/auth';
import {
  Auditable,
  AuditAction,
  AuthThrottle,
  ModuleName as M,
  ParseHexTokenPipe,
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

import { SyncUserRolesDTO, UserRoleVM } from '../user-roles/dtos';
import {
  AcceptInviteDTO,
  InvitationResponseVM,
  InvitationsQueryDTO,
  InviteValidationResponseVM,
  SendInviteDTO,
} from './dtos';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitations')
@ApiStandardErrors()
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
  @Auditable({
    action: AuditAction.Create,
    entityType: 'invitation',
    descriptionTemplate: '{actor} sent invitation',
    dtoClass: SendInviteDTO,
  })
  @ApiOperation({ summary: 'Send an invitation' })
  @ApiWrappedResponse({ type: InvitationResponseVM, description: 'Invitation sent', status: 201 })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already invited or exists',
    type: ErrorResponseVM,
  })
  sendInvite(
    @Body() dto: SendInviteDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<InvitationResponseVM> {
    return this.invitationsService.sendInvite(dto, user);
  }

  @Post('list')
  @HttpCode(HttpStatus.OK)
  @Permissions(perm(M.Users, A.Admin))
  @ApiOperation({ summary: 'List invitations' })
  @ApiPaginatedWrappedResponse({
    type: InvitationResponseVM,
    description: 'Paginated invitation list',
  })
  findAll(
    @Body() query: InvitationsQueryDTO,
  ): Promise<OffsetPaginatedResultVM<InvitationResponseVM>> {
    return this.invitationsService.findAll(query);
  }

  @Get('validate/:token')
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Validate an invitation token' })
  @ApiWrappedResponse({ type: InviteValidationResponseVM, description: 'Token validation result' })
  @ApiParam({ name: 'token', description: 'Invitation token', type: String })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired token',
    type: ErrorResponseVM,
  })
  validateToken(
    @Param('token', ParseHexTokenPipe) token: string,
  ): Promise<InviteValidationResponseVM> {
    return this.invitationsService.validateToken(token);
  }

  @Post('accept/:token')
  @Public()
  @AuthThrottle()
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiWrappedResponse({ type: InvitationResponseVM, description: 'Invitation accepted' })
  @ApiParam({ name: 'token', description: 'Invitation token', type: String })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired token',
    type: ErrorResponseVM,
  })
  acceptInvite(
    @Param('token', ParseHexTokenPipe) token: string,
    @Body() dto: AcceptInviteDTO,
  ): Promise<InvitationResponseVM> {
    return this.invitationsService.acceptInvite(token, dto);
  }

  @Post(':userId/resend')
  @Permissions(perm(M.Users, A.Admin))
  @Auditable({
    action: AuditAction.ResendInvite,
    entityType: 'invitation',
    entityIdExtractor: (req) => req.params['userId'] as string,
    resourceNameExtractor: (req) => `Invitation for User #${req.params['userId']}`,
    descriptionTemplate: '{actor} resent {resourceName}',
    targetUserIdExtractor: (req) => req.params['userId'] as string,
  })
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiWrappedResponse({ type: InvitationResponseVM, description: 'Invitation resent' })
  @ApiParam({ name: 'userId', description: 'User ID to resend invitation for', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
    type: ErrorResponseVM,
  })
  resendInvite(@Param('userId', ParseIntPipe) userId: number): Promise<InvitationResponseVM> {
    return this.invitationsService.resendInvite(userId);
  }

  @Patch(':userId/roles')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy('userId')
  @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
  @PreventSelfAction('userId', 'Cannot modify your own role assignments')
  @Auditable({
    action: AuditAction.Update,
    entityType: 'invitation',
    entityIdExtractor: (req) => req.params['userId'] as string,
    resourceNameExtractor: (req) => `Invitation roles for User #${req.params['userId']}`,
    descriptionTemplate: '{actor} updated roles for {resourceName}',
    dtoClass: SyncUserRolesDTO,
    targetUserIdExtractor: (req) => req.params['userId'] as string,
  })
  @ApiOperation({ summary: 'Update roles for an invited user' })
  @ApiWrappedResponse({ type: UserRoleVM, isArray: true, description: 'Updated role list' })
  @ApiParam({ name: 'userId', description: 'User ID of the invited user', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation or role not found',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  syncRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SyncUserRolesDTO,
    @CurrentUser() assigner: IUserContext,
  ): Promise<UserRoleVM[]> {
    return this.invitationsService.syncRoles(userId, dto.roleIds, assigner);
  }

  @Delete(':userId')
  @Permissions(perm(M.Users, A.Admin))
  @Auditable({
    action: AuditAction.Delete,
    entityType: 'invitation',
    entityIdExtractor: (req) => req.params['userId'] as string,
    resourceNameExtractor: (req) => `Invitation for User #${req.params['userId']}`,
    descriptionTemplate: '{actor} revoked {resourceName}',
    targetUserIdExtractor: (req) => req.params['userId'] as string,
  })
  @ApiOperation({ summary: 'Revoke an invitation' })
  @ApiWrappedResponse({ type: InvitationResponseVM, description: 'Invitation revoked' })
  @ApiParam({ name: 'userId', description: 'User ID to revoke invitation for', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
    type: ErrorResponseVM,
  })
  revokeInvite(@Param('userId', ParseIntPipe) userId: number): Promise<InvitationResponseVM> {
    return this.invitationsService.revokeInvite(userId);
  }
}
