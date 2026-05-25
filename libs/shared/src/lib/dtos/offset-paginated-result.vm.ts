import type { IPaginatedResponse } from '@mediastar/core';
import { ApiProperty } from '@nestjs/swagger';

import { BasePaginatedResultVM } from './base-paginated-result.vm';

export class OffsetPaginatedResultVM<T>
  extends BasePaginatedResultVM<T>
  implements IPaginatedResponse<T>
{
  @ApiProperty({ description: 'Total number of items across all pages', example: 100 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;
}
