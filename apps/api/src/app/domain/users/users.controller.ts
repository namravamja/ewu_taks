import {
  CurrentUser,
  EnforceRoleEntityHierarchy,
  EnforceRoleHierarchy,
  EnforceScope,
  EnforceTrashBulkAction,
  Permissions,
  PreventSelfAction,
  RbacService,
  TwoFactorService,
  TwoFactorStatsVM,
  VALIDATION_ERROR_DESC,
} from '@mediastar/auth';
import {
  Auditable,
  AuditAction,
  ModuleName as M,
  perm,
  PermissionAction as A,
  PermissionScope as S,
} from '@mediastar/core';
import {
  ApiPaginatedWrappedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
  BulkTrashActionDTO,
  BulkTrashActionResultVM,
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
  AdminChangeEmailDTO,
  AdminSetPasswordDTO,
  ApproveUserDTO,
  DeletedUserResponseVM,
  ReactivateUserDTO,
  RejectUserDTO,
  TrashUsersQueryDTO,
  TwoFactorEnforcementDTO,
  TwoFactorEnforcementResultVM,
  UnrejectUserDTO,
  UpdateAuthProviderDTO,
  UpdateUserDTO,
  UserResponseVM,
  UsersQueryDTO,
} from './dtos';
import { UsersService } from './users.service';

const NOT_FOUND_DESC = 'User not found';
const DELETED_NOT_FOUND_DESC = 'Deleted user not found';

@ApiTags('Users')
@ApiStandardErrors()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly twoFactorService: TwoFactorService,
    private readonly rbacService: RbacService,
  ) {}

  @Post('list')
  @HttpCode(HttpStatus.OK)
  @Permissions(perm(M.Users, A.Read))
  @ApiOperation({ summary: 'List users with pagination and filters' })
  @ApiWrappedResponse({ type: UserResponseVM, isArray: true, description: 'Paginated user list' })
  listUsers(@Body() query: UsersQueryDTO): Promise<OffsetPaginatedResultVM<UserResponseVM>> {
    return this.usersService.listUsers(query);
  }

  @Get('two-factor/stats')
  @Permissions(perm(M.Users, A.Admin))
  @ApiOperation({ summary: 'Get 2FA adoption statistics' })
  @ApiWrappedResponse({ type: TwoFactorStatsVM, description: '2FA adoption stats' })
  async getTwoFactorStats(): Promise<TwoFactorStatsVM> {
    return this.twoFactorService.getStats();
  }

  @Post('2fa-enforcement')
  @Permissions(perm(M.Users, A.Update))
  @Auditable({
    action: AuditAction.TwoFactorEnforcementChange,
    entityType: 'user',
    descriptionTemplate: '{actor} changed 2FA enforcement for users',
    dtoClass: TwoFactorEnforcementDTO,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enforce or de-enforce 2FA for specific users or all users' })
  @ApiWrappedResponse({
    type: TwoFactorEnforcementResultVM,
    description: '2FA enforcement updated',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  updateTwoFactorEnforcement(
    @CurrentUser() user: IUserContext,
    @Body() dto: TwoFactorEnforcementDTO,
  ): Promise<TwoFactorEnforcementResultVM> {
    return this.usersService.updateTwoFactorEnforcement(dto, user);
  }

  // ── Trash (soft-deleted users) ──────────────────────────────────

  @Post('trash')
  @HttpCode(HttpStatus.OK)
  @Permissions(perm(M.Trash, A.View))
  @ApiOperation({ summary: 'List soft-deleted users' })
  @ApiPaginatedWrappedResponse({
    type: DeletedUserResponseVM,
    description: 'Paginated list of soft-deleted users',
  })
  listDeletedUsers(
    @Body() query: TrashUsersQueryDTO,
  ): Promise<OffsetPaginatedResultVM<DeletedUserResponseVM>> {
    return this.usersService.listDeletedUsers(query);
  }

  @Get('trash/:id')
  @Permissions(perm(M.Trash, A.View))
  @ApiOperation({ summary: 'View a soft-deleted user' })
  @ApiWrappedResponse({ type: DeletedUserResponseVM, description: 'Deleted user details' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: DELETED_NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  getDeletedUser(@Param('id', ParseIntPipe) id: number): Promise<DeletedUserResponseVM> {
    return this.usersService.findDeletedById(id);
  }

  @Post('trash/bulk-action')
  @HttpCode(HttpStatus.OK)
  @Permissions(perm(M.Trash, A.Restore), perm(M.Trash, A.HardDelete))
  @EnforceTrashBulkAction()
  @Auditable({
    action: AuditAction.BulkAction,
    entityType: 'user',
    resourceNameExtractor: (req) => {
      const body = req.body as { action?: string; ids?: number[] } | undefined;
      return `Bulk ${body?.action ?? 'action'} on ${body?.ids?.length ?? 0} users`;
    },
    descriptionTemplate: '{actor} performed {resourceName}',
    dtoClass: BulkTrashActionDTO,
  })
  @ApiOperation({ summary: 'Bulk restore or hard-delete soft-deleted users' })
  @ApiWrappedResponse({
    type: BulkTrashActionResultVM,
    description: 'Bulk trash action result with partial success details',
  })
  bulkTrashAction(
    @Body() dto: BulkTrashActionDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<BulkTrashActionResultVM> {
    return this.usersService.bulkTrashAction(dto, user.userId);
  }

  @Patch('trash/:id/restore')
  @Permissions(perm(M.Trash, A.Restore))
  @Auditable({
    action: AuditAction.Restore,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} restored {resourceName} from trash',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Restored user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: DELETED_NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User exists but is not in trash',
    type: ErrorResponseVM,
  })
  restoreUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    return this.usersService.restoreUser(id, user.userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Current user details' })
  getCurrentUser(@CurrentUser() user: IUserContext): Promise<UserResponseVM> {
    return this.usersService.findById(user.userId);
  }

  @Patch('me')
  @Auditable({
    action: AuditAction.Update,
    entityType: 'user',
    entityIdExtractor: (req) => String((req as { user?: { userId?: number } }).user?.userId),
    resourceNameExtractor: (req) => `User #${(req as { user?: { userId?: number } }).user?.userId}`,
    descriptionTemplate: '{actor} updated their own profile',
    dtoClass: UpdateUserDTO,
    targetUserIdExtractor: (req) => String((req as { user?: { userId?: number } }).user?.userId),
  })
  @ApiOperation({ summary: 'Update the current authenticated user profile' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Updated user' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  updateCurrentUser(
    @CurrentUser() user: IUserContext,
    @Body() dto: UpdateUserDTO,
  ): Promise<UserResponseVM> {
    return this.usersService.updateCurrentUser(user.userId, dto);
  }

  @Get(':id')
  @Permissions(perm(M.Users, A.Read, S.OWN))
  @EnforceScope('id', 'You can only view your own profile')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'User details' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  getUserById(@Param('id', ParseIntPipe) id: number): Promise<UserResponseVM> {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
  @PreventSelfAction(
    'id',
    'Cannot modify your own profile through this endpoint — use PATCH /users/me',
  )
  @ApiOperation({ summary: 'Update a user profile (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Updated user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    return this.usersService.updateUser(id, dto, user.userId);
  }

  @Patch(':id/password')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot set your own password through this endpoint')
  @Auditable({
    action: AuditAction.SetPassword,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} set password for {resourceName}',
    dtoClass: AdminSetPasswordDTO,
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a user password (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Password set successfully' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  setPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminSetPasswordDTO,
  ): Promise<void> {
    return this.usersService.setPassword(id, dto);
  }

  @Patch(':id/email')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot change your own email through this endpoint')
  @Auditable({
    action: AuditAction.ChangeEmail,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} changed email for {resourceName}',
    dtoClass: AdminChangeEmailDTO,
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change a user email (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Email changed successfully' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email already exists',
    type: ErrorResponseVM,
  })
  changeEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminChangeEmailDTO,
  ): Promise<void> {
    return this.usersService.changeEmail(id, dto);
  }

  @Patch(':id/auth-provider')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot change your own auth provider')
  @Auditable({
    action: AuditAction.ProviderSwitch,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} switched auth provider for {resourceName}',
    dtoClass: UpdateAuthProviderDTO,
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Switch auth provider for a user (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Updated user with new auth providers' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: VALIDATION_ERROR_DESC,
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  switchAuthProvider(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAuthProviderDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    return this.usersService.switchAuthProvider(id, dto, user.userId);
  }

  @Patch(':id/approve')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
  @PreventSelfAction('id', 'Cannot approve your own registration')
  @Auditable({
    action: AuditAction.Approve,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} approved registration for {resourceName}',
    dtoClass: ApproveUserDTO,
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Approve a pending user registration (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Approved user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User is not in PENDING status',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  async approveUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveUserDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    const canAssignPeerLevel = await this.rbacService.checkPermissionWithScopeForRoles(
      user.roles.map((r) => r.id),
      M.Roles,
      A.Manage,
      S.ALL,
    );
    return this.usersService.approveUser(
      id,
      user.userId,
      dto,
      user.effectiveRoleLevel,
      canAssignPeerLevel,
    );
  }

  @Patch(':id/reject')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot reject your own registration')
  @Auditable({
    action: AuditAction.Reject,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} rejected registration for {resourceName}',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Reject a pending user registration (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Rejected user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User is not in PENDING status',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  rejectUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectUserDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    return this.usersService.rejectUser(id, user.userId, dto.reason);
  }

  @Patch(':id/unreject')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
  @PreventSelfAction('id', 'Cannot un-reject your own registration')
  @Auditable({
    action: AuditAction.UnReject,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} un-rejected registration for {resourceName}',
    dtoClass: UnrejectUserDTO,
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Un-reject a rejected user (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Un-rejected user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User is not in REJECTED status',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  async unrejectUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UnrejectUserDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    const canAssignPeerLevel = await this.rbacService.checkPermissionWithScopeForRoles(
      user.roles.map((r) => r.id),
      M.Roles,
      A.Manage,
      S.ALL,
    );
    return this.usersService.unrejectUser(
      id,
      user.userId,
      dto,
      user.effectiveRoleLevel,
      canAssignPeerLevel,
    );
  }

  @Patch(':id/suspend')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot suspend your own account')
  @Auditable({
    action: AuditAction.Suspend,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} suspended {resourceName}',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Suspend an active user (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Suspended user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User is not in ACTIVE status',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  suspendUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    return this.usersService.suspendUser(id, user.userId);
  }

  @Patch(':id/unsuspend')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot unsuspend your own account')
  @Auditable({
    action: AuditAction.Unsuspend,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} unsuspended {resourceName}',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Unsuspend a suspended user (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Unsuspended user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User is not in SUSPENDED status',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  unsuspendUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    return this.usersService.unsuspendUser(id, user.userId);
  }

  @Patch(':id/reactivate')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })
  @PreventSelfAction('id', 'Cannot reactivate your own account')
  @Auditable({
    action: AuditAction.Reactivate,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} reactivated {resourceName}',
    dtoClass: ReactivateUserDTO,
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Reactivate an inactive user (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Reactivated user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User is not in INACTIVE status or no auth provider enabled',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  async reactivateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReactivateUserDTO,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    const canAssignPeerLevel = await this.rbacService.checkPermissionWithScopeForRoles(
      user.roles.map((r) => r.id),
      M.Roles,
      A.Manage,
      S.ALL,
    );
    return this.usersService.reactivateUser(
      id,
      user.userId,
      dto,
      user.effectiveRoleLevel,
      canAssignPeerLevel,
    );
  }

  @Patch(':id/deactivate')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot deactivate your own account')
  @Auditable({
    action: AuditAction.Deactivate,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} deactivated {resourceName}',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @ApiOperation({ summary: 'Deactivate an active or suspended user (admin only)' })
  @ApiWrappedResponse({ type: UserResponseVM, description: 'Deactivated user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User is not in ACTIVE or SUSPENDED status',
    type: ErrorResponseVM,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  deactivateUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<UserResponseVM> {
    return this.usersService.deactivateUser(id, user.userId);
  }

  @Delete(':id/two-factor')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot disable your own 2FA through this endpoint')
  @Auditable({
    action: AuditAction.TwoFactorAdminDisable,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} disabled 2FA for {resourceName}',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin disable 2FA for a user' })
  @ApiWrappedResponse({
    description: '2FA disabled for user',
    dataSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Two-factor authentication disabled for user' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '2FA not enabled',
    type: ErrorResponseVM,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: NOT_FOUND_DESC, type: ErrorResponseVM })
  async adminDisableTwoFactor(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.usersService.adminDisableTwoFactor(id);
    return { message: 'Two-factor authentication disabled for user' };
  }

  @Post(':id/2fa/reset')
  @Permissions(perm(M.Users, A.Admin))
  @EnforceRoleHierarchy()
  @PreventSelfAction('id', 'Cannot reset your own 2FA through this endpoint')
  @Auditable({
    action: AuditAction.TwoFactorAdminReset,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} reset 2FA for {resourceName}',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin reset 2FA for a user' })
  @ApiWrappedResponse({
    description: '2FA reset for user',
    dataSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Two-factor authentication has been reset for user' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: NOT_FOUND_DESC, type: ErrorResponseVM })
  async adminResetTwoFactor(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.usersService.resetTwoFactor(id);
    return { message: 'Two-factor authentication has been reset for user' };
  }

  @Delete(':id')
  @Permissions(perm(M.Users, A.Delete, S.OWN))
  @EnforceScope('id', 'You can only delete your own account')
  @EnforceRoleHierarchy()
  @Auditable({
    action: AuditAction.Delete,
    entityType: 'user',
    entityIdExtractor: (req) => req.params['id'] as string,
    resourceNameExtractor: (req) => `User #${req.params['id']}`,
    descriptionTemplate: '{actor} soft-deleted {resourceName}',
    targetUserIdExtractor: (req) => req.params['id'] as string,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'User soft-deleted' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NOT_FOUND_DESC,
    type: ErrorResponseVM,
  })
  softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: IUserContext,
  ): Promise<void> {
    return this.usersService.softDelete(id, user.userId);
  }
}
