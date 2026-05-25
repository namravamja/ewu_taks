import { AuthModule } from '@mediastar/auth';
import { Module } from '@nestjs/common';

import { UserRolesController } from './user-roles.controller';
import { UserRolesRepository } from './user-roles.repository';
import { UserRolesService } from './user-roles.service';

@Module({
  imports: [AuthModule],
  controllers: [UserRolesController],
  providers: [UserRolesRepository, UserRolesService],
  exports: [UserRolesService],
})
export class UserRolesModule {}
