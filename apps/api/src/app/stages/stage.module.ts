import { Module } from '@nestjs/common';

import { StageController } from './stage.controller';
import { StageRepository } from './stage.repository';
import { StageService } from './stage.service';

@Module({
  controllers: [StageController],
  providers: [StageRepository, StageService],
  exports: [StageService],
})
export class StageModule {}
