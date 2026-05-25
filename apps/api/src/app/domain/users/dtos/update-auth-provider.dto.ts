import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

import type { IUpdateAuthProvider } from '../interfaces/update-auth-provider.interface';

export class UpdateAuthProviderDTO implements IUpdateAuthProvider {
  @ApiProperty({ description: 'Enable credential (password) login', example: true })
  @IsBoolean()
  readonly isCredentialEnabled!: boolean;
}
