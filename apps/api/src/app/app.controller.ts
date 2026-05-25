import { Public } from '@mediastar/auth';
import { ApiWrappedResponse } from '@mediastar/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health ping' })
  @ApiWrappedResponse({
    description: 'Application is running',
    dataSchema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Hello API' } },
    },
  })
  getData(): { message: string } {
    return this.appService.getData();
  }
}
