import { Injectable } from '@nestjs/common';

import { CaseFilterField } from './enums/filter-field.enum';
import type { IFilterDataSourceResponse } from './interfaces/filter-datasource.interface';

const DEFAULT_SEARCH_PARAM = 'search';

const DATA_SOURCE_BY_FIELD: Partial<Record<CaseFilterField, IFilterDataSourceResponse>> = {
  [CaseFilterField.ASSIGNEE_IDS]: {
    url: '/users/filter-options',
    searchParam: DEFAULT_SEARCH_PARAM,
  },
  [CaseFilterField.CITY]: {
    url: '/cases/filter-options/city',
    searchParam: DEFAULT_SEARCH_PARAM,
  },
  [CaseFilterField.STATE]: {
    url: '/cases/filter-options/state',
    searchParam: DEFAULT_SEARCH_PARAM,
  },
};

@Injectable()
export class FilterDataSourceRegistry {
  resolve(field: string, dataSource: string | null): IFilterDataSourceResponse | null {
    const explicit = this.resolveExplicitDataSource(dataSource);
    if (explicit) {
      return explicit;
    }

    return DATA_SOURCE_BY_FIELD[field as CaseFilterField] ?? null;
  }

  private resolveExplicitDataSource(dataSource: string | null): IFilterDataSourceResponse | null {
    if (!dataSource) {
      return null;
    }

    const normalized = dataSource.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.startsWith('/')) {
      return {
        url: normalized,
        searchParam: DEFAULT_SEARCH_PARAM,
      };
    }

    return null;
  }
}
