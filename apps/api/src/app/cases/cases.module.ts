import { Module } from '@nestjs/common';
import { FilterModule } from '../filters/filter.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CaseRepository } from './cases.repository';

@Module({
  imports: [FilterModule],
  controllers: [CasesController],
  providers: [CasesService, CaseRepository],
  exports: [CasesService],
})
export class CasesModule {}
