import { AuthModule } from '@mediastar/auth';
import { SharedModule } from '@mediastar/shared';
import { Module } from '@nestjs/common';

import { RolesModule } from '../../roles/roles.module';
import { UserRolesModule } from '../user-roles/user-roles.module';
import { UsersModule } from '../users.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [SharedModule, AuthModule, UsersModule, UserRolesModule, RolesModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRepository],
})
export class InvitationsModule {}
