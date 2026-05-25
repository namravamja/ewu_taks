import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';

import {
  type IBulkTrashAction,
  TRASH_BULK_ACTIONS,
  type TrashBulkAction,
} from '../interfaces/bulk-trash-action.interface';

export class BulkTrashActionDTO implements IBulkTrashAction {
  @Expose()
  @ApiProperty({
    description: 'The trash action to perform',
    enum: TRASH_BULK_ACTIONS,
    example: 'restore',
  })
  @IsIn(TRASH_BULK_ACTIONS)
  @Type(() => String)
  action: TrashBulkAction;

  @Expose()
  @ApiProperty({
    description: 'IDs of records to act on (1–50)',
    type: Number,
    isArray: true,
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  ids: number[];
}
