import { AuthModule, JwtAuthGuard, PermissionsGuard, ScopeResolutionGuard } from '@mediastar/auth';
import { CacheModule, CoreModule } from '@mediastar/core';
import { AppConfigModule } from '@mediastar/core/config';
import { DatabaseModule } from '@mediastar/database';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AuditModule } from '../audit/audit.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './core/health/health.module';
import { AppThrottlerGuard } from './core/throttler/app-throttler.guard';
import { ThrottlerConfigModule } from './core/throttler/throttler.config';
import { PermissionsModule } from './domain/permissions/permissions.module';
import { RolesModule } from './domain/roles/roles.module';
import { StageModule } from './stages/stage.module';
import { InvitationsModule } from './domain/users/invitations/invitations.module';
import { UsersModule } from './domain/users/users.module';
import { CasesModule } from './cases/cases.module';

@Module({
  imports: [
    AppConfigModule.forRoot({ schema: 'api' }),
    DatabaseModule,
    CacheModule,
    CoreModule,
    AuditModule,
    AuthModule,
    EventEmitterModule.forRoot(),
    ThrottlerConfigModule,
    HealthModule,
    UsersModule,
    InvitationsModule,
    PermissionsModule,
    RolesModule,
    StageModule,
    CasesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useExisting: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ScopeResolutionGuard },
  ],
})
export class AppModule {}
