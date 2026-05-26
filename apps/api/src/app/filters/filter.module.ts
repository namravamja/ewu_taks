import { Module } from '@nestjs/common';

import { FilterController } from './filter.controller';
import { FilterDataSourceRegistry } from './filter-datasource.registry';
import { FilterQueryBuilderService } from './filter-query-builder.service';
import { FilterRepository } from './filter.repository';
import { FilterService } from './filter.service';

@Module({
  controllers: [FilterController],
  providers: [FilterRepository, FilterService, FilterQueryBuilderService, FilterDataSourceRegistry],
  exports: [FilterService, FilterQueryBuilderService],
})
export class FilterModule {}
