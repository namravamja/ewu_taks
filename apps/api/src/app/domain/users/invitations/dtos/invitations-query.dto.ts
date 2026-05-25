import { InviteStatus } from '@mediastar/database';
import { OffsetPaginationDTO } from '@mediastar/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import type { IInvitationsQuery } from '../interfaces/invitations-query.interface';

export class InvitationsQueryDTO extends OffsetPaginationDTO implements IInvitationsQuery {
  @ApiPropertyOptional({
    description: 'Filter by invite status',
    enum: InviteStatus,
    enumName: 'InviteStatus',
    example: InviteStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(InviteStatus)
  inviteStatus?: InviteStatus;
}
