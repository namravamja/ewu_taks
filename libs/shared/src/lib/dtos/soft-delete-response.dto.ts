import { UndoEntityType } from '@mediastar/core';
import { ApiProperty } from '@nestjs/swagger';

export class UndoTokenDto {
  @ApiProperty({
    description: 'Opaque undo token',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  token: string;

  @ApiProperty({ description: 'Token expiry (ISO 8601)', example: '2026-05-01T19:30:00.000Z' })
  expiresAt: string;
}

export class DeletedEntityDto {
  @ApiProperty({ enum: UndoEntityType, enumName: 'UndoEntityType', description: 'Entity type' })
  type: UndoEntityType;

  @ApiProperty({ description: 'Entity IDs', type: Number, isArray: true, example: [123] })
  ids: number[];

  @ApiProperty({ description: 'Human-readable label for the toast', example: 'Comment by Aimee' })
  displayLabel: string;
}

export class SoftDeleteResponseDto {
  @ApiProperty({ description: 'Always true', example: true })
  success: true;

  @ApiProperty({ type: DeletedEntityDto })
  deletedEntity: DeletedEntityDto;

  @ApiProperty({ type: UndoTokenDto })
  undo: UndoTokenDto;
}
