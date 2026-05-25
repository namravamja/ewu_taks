import { InviteStatus } from '@mediastar/database';
import { PopulatedUserDto } from '@mediastar/shared';
import { ApiProperty } from '@nestjs/swagger';

import type {
  IInvitationResponse,
  IInviteValidationResponse,
} from '../interfaces/invitation.interface';

export class InvitationResponseVM implements IInvitationResponse {
  @ApiProperty({ description: 'User ID of the invited user', example: 1 })
  readonly id!: number;

  @ApiProperty({ description: 'Invited email address', example: 'pqr@domain.com' })
  readonly email!: string;

  @ApiProperty({ description: 'First name of the invited user', example: 'John', nullable: true })
  readonly firstName!: string | null;

  @ApiProperty({ description: 'Last name of the invited user', example: 'Doe', nullable: true })
  readonly lastName!: string | null;

  @ApiProperty({
    description: 'Current invite status',
    example: InviteStatus.PENDING,
    nullable: true,
    enum: InviteStatus,
  })
  readonly status!: InviteStatus | null;

  @ApiProperty({
    description: 'Invitation creation timestamp',
    example: '2026-03-10T12:00:00.000Z',
  })
  readonly createdAt!: Date;

  @ApiProperty({
    description: 'User who sent the invitation',
    type: PopulatedUserDto,
    nullable: true,
  })
  readonly invitedBy!: PopulatedUserDto | null;
}

export class InviteValidationResponseVM implements IInviteValidationResponse {
  @ApiProperty({ description: 'Invited email address', example: 'pqr@domain.com' })
  readonly email!: string;

  @ApiProperty({ description: 'First name of the invited user', example: 'John', nullable: true })
  readonly firstName!: string | null;

  @ApiProperty({ description: 'Last name of the invited user', example: 'Doe', nullable: true })
  readonly lastName!: string | null;

  @ApiProperty({ description: 'Whether the invitation token is valid', example: true })
  readonly valid!: boolean;
}
