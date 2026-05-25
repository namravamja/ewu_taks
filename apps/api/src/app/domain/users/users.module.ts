import { AuthModule } from '@mediastar/auth';
import { SharedModule } from '@mediastar/shared';
import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../../../audit/audit.module';
import { RolesModule } from '../roles/roles.module';
import { UserStatusService } from './services/user-status.service';
import { UserRolesModule } from './user-roles/user-roles.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Global()
@Module({
  imports: [AuthModule, AuditModule, SharedModule, UserRolesModule, RolesModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserStatusService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
