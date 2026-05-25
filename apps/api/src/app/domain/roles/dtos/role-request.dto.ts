import { PermissionScope } from '@mediastar/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import type {
  ICreateRole,
  IPermissionAssignment,
  IUpdateRole,
} from '../interfaces/role-request.interface';

export class PermissionAssignmentDTO implements IPermissionAssignment {
  @ApiProperty({ description: 'ID of the permission to assign', minimum: 1, example: 5 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  permissionId!: number;

  @ApiPropertyOptional({
    description: 'Permission scope',
    enum: PermissionScope,
    enumName: 'PermissionScope',
    default: PermissionScope.ALL,
    example: 'ALL',
  })
  @IsEnum(PermissionScope)
  @IsOptional()
  scope: PermissionScope = PermissionScope.ALL;
}

export class CreateRoleDTO implements ICreateRole {
  @ApiProperty({ description: 'Role name', minLength: 2, maxLength: 50, example: 'Case Manager' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({
    description: 'Role description',
    maxLength: 500,
    example: 'Manages case lifecycle and assignments',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Permissions to assign to the role',
    type: PermissionAssignmentDTO,
    isArray: true,
    minItems: 1,
  })
  @ValidateNested({ each: true })
  @Type(() => PermissionAssignmentDTO)
  @ArrayMinSize(1)
  permissions!: PermissionAssignmentDTO[];
}

export class UpdateRoleDTO implements IUpdateRole {
  @ApiPropertyOptional({
    description: 'Role name',
    minLength: 2,
    maxLength: 50,
    example: 'Case Manager',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Role description',
    maxLength: 500,
    example: 'Manages case lifecycle and assignments',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Permissions to assign to the role',
    type: PermissionAssignmentDTO,
    isArray: true,
    minItems: 1,
  })
  @ValidateNested({ each: true })
  @Type(() => PermissionAssignmentDTO)
  @ArrayMinSize(1)
  @IsOptional()
  permissions?: PermissionAssignmentDTO[];
}
