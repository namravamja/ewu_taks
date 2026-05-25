import { SensitiveField } from '@mediastar/core';

import { IsValidPassword } from '../decorators/is-valid-password.decorator';
import type { IPasswordRequest } from '../interfaces/password-request.interface';

export class PasswordDTO implements IPasswordRequest {
  @SensitiveField()
  @IsValidPassword()
  readonly password!: string;
}
