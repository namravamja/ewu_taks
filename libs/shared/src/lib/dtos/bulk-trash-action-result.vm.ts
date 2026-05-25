import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import type {
  IBulkTrashActionError,
  IBulkTrashActionResult,
} from '../interfaces/bulk-trash-action.interface';

export class BulkTrashActionErrorVM implements IBulkTrashActionError {
  @ApiProperty({ description: 'ID of the record that failed', example: 42 })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Reason for failure', example: 'not_found' })
  @Expose()
  reason: string;
}

export class BulkTrashActionResultVM implements IBulkTrashActionResult {
  @ApiProperty({
    description: 'IDs of records successfully processed',
    type: Number,
    isArray: true,
    example: [1, 2, 3],
  })
  @Expose()
  succeeded: number[];

  @ApiProperty({
    description: 'Per-record error details',
    type: BulkTrashActionErrorVM,
    isArray: true,
  })
  @Expose()
  failed: BulkTrashActionErrorVM[];
}
