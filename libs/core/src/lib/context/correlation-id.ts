import { AsyncLocalStorage } from 'node:async_hooks';

import type { PermissionScope } from '../enums/permission-scope.enum';

export interface IScopeContext {
  readonly effectiveScope: PermissionScope;
  readonly userId: number;
  readonly teamIds?: number[];
}

interface RequestContext {
  correlationId: string;
  scopeContext?: IScopeContext;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const NO_CORRELATION_ID = 'N/A';

export function getCorrelationId(): string {
  return requestContextStorage.getStore()?.correlationId ?? NO_CORRELATION_ID;
}

export function setScopeContext(scopeContext: IScopeContext): void {
  const store = requestContextStorage.getStore();
  if (store) {
    store.scopeContext = scopeContext;
  }
}

export function getScopeContext(): IScopeContext | undefined {
  return requestContextStorage.getStore()?.scopeContext;
}
