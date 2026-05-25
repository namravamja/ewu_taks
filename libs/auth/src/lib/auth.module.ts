import { GeoLocationModule } from '@mediastar/core';
import { SharedModule } from '@mediastar/shared';
import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RoleEntityHierarchyGuard } from './guards/role-entity-hierarchy.guard';
import { RoleHierarchyGuard } from './guards/role-hierarchy.guard';
import { ScopeGuard } from './guards/scope.guard';
import { ScopeResolutionGuard } from './guards/scope-resolution.guard';
import { TrashBulkActionGuard } from './guards/trash-bulk-action.guard';
import { TokenService } from './jwt/token.service';
import { RbacService } from './rbac/rbac.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { CaptchaService } from './services/captcha.service';
import { TeamMembershipCacheService } from './services/team-membership-cache.service';
import { UserService } from './services/user.service';
import { SessionRepository } from './session/session.repository';
import { SessionCacheService } from './session/session-cache.service';
import { SessionCleanupService } from './session/session-cleanup.service';
import { UserRoleCacheService } from './session/user-role-cache.service';
import { BackupCodeRepository } from './two-factor/backup-code.repository';
import { TrustedDeviceRepository } from './two-factor/trusted-device.repository';
import { TrustedDeviceService } from './two-factor/trusted-device.service';
import { TwoFactorService } from './two-factor/two-factor.service';
import { UserRepository } from './user/user.repository';

@Module({
  imports: [SharedModule, GeoLocationModule],
  controllers: [AuthController],
  providers: [
    AuthCookieService,
    AuthService,
    CaptchaService,
    TokenService,
    UserService,
    UserRepository,
    SessionRepository,
    BackupCodeRepository,
    TrustedDeviceRepository,
    JwtAuthGuard,
    PermissionsGuard,
    RoleEntityHierarchyGuard,
    RoleHierarchyGuard,
    ScopeGuard,
    ScopeResolutionGuard,
    TrashBulkActionGuard,
    TeamMembershipCacheService,
    RbacService,
    SessionCacheService,
    SessionCleanupService,
    TwoFactorService,
    TrustedDeviceService,
    UserRoleCacheService,
  ],
  exports: [
    AuthCookieService,
    AuthService,
    TokenService,
    UserService,
    SessionRepository,
    JwtAuthGuard,
    PermissionsGuard,
    RoleEntityHierarchyGuard,
    RoleHierarchyGuard,
    ScopeGuard,
    ScopeResolutionGuard,
    TrashBulkActionGuard,
    TeamMembershipCacheService,
    RbacService,
    SessionCacheService,
    SessionCleanupService,
    TwoFactorService,
    TrustedDeviceService,
    UserRoleCacheService,
  ],
})
export class AuthModule {}
