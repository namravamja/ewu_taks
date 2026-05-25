import type { ICursorPaginatedResponse } from '@mediastar/core';
import { ApiProperty } from '@nestjs/swagger';

import { BasePaginatedResultVM } from './base-paginated-result.vm';

export class CursorPaginatedResultVM<T>
  extends BasePaginatedResultVM<T>
  implements ICursorPaginatedResponse<T>
{
  @ApiProperty({
    description: 'Cursor for the next page of results',
    example: 'eyJpZCI6NDJ9',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({
    description: 'Cursor for the previous page of results',
    example: 'eyJpZCI6MX0',
    nullable: true,
  })
  previousCursor: string | null;

  @ApiProperty({ description: 'Whether there are more results after this page', example: true })
  hasNextPage: boolean;

  @ApiProperty({ description: 'Whether there are results before this page', example: false })
  hasPreviousPage: boolean;
}
