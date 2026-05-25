import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorRecoveryConfirmDTO {
  @ApiProperty({
    description: 'Recovery token received via email',
    example: 'a3f8c2e1d4b6a9f0e7c5b2d8a1f4e3c6a9b0d7e2f5c8a3b6d9e0f1c4a7b2d5e8',
  })
  @IsString()
  @Length(64, 64)
  readonly token!: string;
}
