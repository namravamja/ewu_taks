import { InviteStatus, UserStatus, UserType } from '@mediastar/database';
import { type IRole, PopulatedUserDto } from '@mediastar/shared';
import { ApiProperty } from '@nestjs/swagger';

import type { IUserInvitationSummary, IUserResponse } from '../interfaces/user-response.interface';

export class UserInvitationSummaryVM implements IUserInvitationSummary {
  @ApiProperty({
    description: 'Invitation lifecycle status',
    enum: InviteStatus,
    enumName: 'InviteStatus',
    example: InviteStatus.PENDING,
  })
  readonly status!: InviteStatus;

  @ApiProperty({
    description: 'When the invitation was sent',
    type: String,
    format: 'date-time',
  })
  readonly invitedAt!: Date;

  @ApiProperty({
    description: 'When the invitation token expires (null if no expiry)',
    nullable: true,
    type: String,
    format: 'date-time',
    example: null,
  })
  readonly tokenExpiresAt!: Date | null;

  @ApiProperty({
    description: 'When the invitee accepted the invitation',
    nullable: true,
    type: String,
    format: 'date-time',
    example: null,
  })
  readonly acceptedAt!: Date | null;

  @ApiProperty({
    description: 'Admin who sent the invitation',
    type: PopulatedUserDto,
    nullable: true,
  })
  readonly invitedBy!: PopulatedUserDto | null;
}

export class RoleVM implements IRole {
  @ApiProperty({ description: 'Role ID', example: 1 })
  readonly id!: number;

  @ApiProperty({ description: 'Role name', example: 'Admin' })
  readonly name!: string;
}

export class UserResponseVM implements IUserResponse {
  @ApiProperty({ description: 'User ID', example: 1 })
  readonly id!: number;

  @ApiProperty({ description: 'First name', nullable: true, example: 'John' })
  readonly firstName!: string | null;

  @ApiProperty({ description: 'Last name', nullable: true, example: 'Doe' })
  readonly lastName!: string | null;

  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  readonly email!: string;

  @ApiProperty({ description: 'Phone number', nullable: true, example: '1234567890' })
  readonly phone!: string | null;

  @ApiProperty({ description: 'Assigned roles', type: RoleVM, isArray: true })
  readonly roles!: RoleVM[];

  @ApiProperty({ description: 'User type', enum: UserType })
  readonly type!: UserType;

  @ApiProperty({ description: 'City', nullable: true, example: null })
  readonly city!: string | null;

  @ApiProperty({ description: 'State', nullable: true, example: null })
  readonly state!: string | null;

  @ApiProperty({ description: 'ZIP code', nullable: true, example: null })
  readonly zip!: string | null;

  @ApiProperty({
    description: 'Account status',
    enum: UserStatus,
    enumName: 'UserStatus',
    example: 'ACTIVE',
  })
  readonly status!: UserStatus;

  @ApiProperty({
    description: 'Last login timestamp',
    nullable: true,
    type: String,
    format: 'date-time',
    example: null,
  })
  readonly lastLoginAt!: Date | null;

  @ApiProperty({
    description: 'Admin who reviewed this registration',
    nullable: true,
    type: Number,
    example: null,
  })
  readonly reviewedBy!: number | null;

  @ApiProperty({
    description: 'When the registration was reviewed',
    nullable: true,
    type: String,
    format: 'date-time',
    example: null,
  })
  readonly reviewedAt!: Date | null;

  @ApiProperty({ description: 'Reason for rejection', nullable: true, example: null })
  readonly rejectionReason!: string | null;

  @ApiProperty({ description: 'Whether credential login is enabled', example: true })
  readonly isCredentialEnabled!: boolean;

  @ApiProperty({ description: 'Whether 2FA is enabled (user has set up TOTP)', example: false })
  readonly isTwoFactorEnabled!: boolean;

  @ApiProperty({ description: 'Whether 2FA is enforced for this user', example: false })
  readonly isTwoFactorEnforced!: boolean;

  @ApiProperty({ description: 'Created timestamp', type: String, format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({ description: 'Last updated timestamp', type: String, format: 'date-time' })
  readonly updatedAt!: Date;

  @ApiProperty({
    description: 'Invitation details (null for self-registered users)',
    type: UserInvitationSummaryVM,
    nullable: true,
  })
  readonly invitation!: UserInvitationSummaryVM | null;
}
