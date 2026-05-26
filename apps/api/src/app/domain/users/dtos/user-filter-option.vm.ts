import { ApiProperty } from '@nestjs/swagger';

export class UserFilterOptionVM {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'John Doe' })
  name!: string;
}
