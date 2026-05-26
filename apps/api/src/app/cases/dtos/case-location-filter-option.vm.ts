import { ApiProperty } from '@nestjs/swagger';

export class CaseLocationFilterOptionVM {
  @ApiProperty({ example: 'New York' })
  id!: string;

  @ApiProperty({ example: 'New York' })
  name!: string;
}