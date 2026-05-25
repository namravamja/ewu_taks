import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword, MaxLength } from 'class-validator';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STRONG_PASSWORD_OPTIONS,
} from '../constants/index';

/**
 * Composed property decorator that applies all standard password validations:
 * `@ApiProperty`, `@IsString`, `@MaxLength(72)`, and `@IsStrongPassword`.
 *
 * @param description - Swagger description (default: 'Password')
 */
export function IsValidPassword(description = 'Password'): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description,
      format: 'password',
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
    }),
    IsNotEmpty(),
    IsString(),
    MaxLength(PASSWORD_MAX_LENGTH),
    IsStrongPassword(STRONG_PASSWORD_OPTIONS),
  );
}
