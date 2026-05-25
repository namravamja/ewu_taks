import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsJWT, IsNotEmpty, IsPositive } from 'class-validator';

export class ResolveSessionConflictDTO {
  @ApiProperty({ description: 'Short-lived session management token from the 409 response' })
  @IsJWT()
  @IsNotEmpty()
  readonly sessionMgmtToken!: string;

  @ApiProperty({ description: 'ID of the session to terminate', example: 42 })
  @IsInt()
  @IsPositive()
  readonly terminateSessionId!: number;
}
