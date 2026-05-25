import { getScopeContext, type IScopeContext } from '../context/correlation-id';
import { PermissionScope } from '../enums/permission-scope.enum';

/**
 * Scope filter configuration for a model.
 *
 * Each function returns a Prisma-compatible `where` clause fragment for its scope level.
 * Scopes are cumulative: TEAM includes OWN + ASSIGNED + TEAM, etc.
 */
export interface ScopeModelConfig {
  own: (userId: number) => Record<string, unknown>;
  assigned?: (userId: number) => Record<string, unknown>;
  team?: (teamIds: number[]) => Record<string, unknown>;
}

const SCOPE_CONFIGS = new Map<string, ScopeModelConfig>();

/**
 * Registers scope filter configuration for a Prisma model.
 * Call this at module load time (top-level or in a module constructor).
 *
 * @param model - Prisma model name in PascalCase (e.g. `'Case'`, `'Task'`).
 * @param config - Scope filter functions for OWN, ASSIGNED, and TEAM.
 */
export function registerScopeConfig(model: string, config: ScopeModelConfig): void {
  SCOPE_CONFIGS.set(model, config);
}

/**
 * Builds the cumulative OR filter for a scope context and model config.
 *
 * ALL      → undefined (no filter)
 * TEAM     → OWN | ASSIGNED | TEAM
 * ASSIGNED → OWN | ASSIGNED
 * OWN      → OWN only
 */
export function buildScopeFilter(
  config: ScopeModelConfig,
  ctx: IScopeContext,
): Record<string, unknown> | undefined {
  if (ctx.effectiveScope === PermissionScope.ALL) {
    return undefined;
  }

  const conditions: Record<string, unknown>[] = [];

  // OWN — always included for non-ALL scopes
  conditions.push(config.own(ctx.userId));

  // ASSIGNED — included for ASSIGNED and TEAM scopes
  if (
    (ctx.effectiveScope === PermissionScope.ASSIGNED ||
      ctx.effectiveScope === PermissionScope.TEAM) &&
    config.assigned
  ) {
    conditions.push(config.assigned(ctx.userId));
  }

  // TEAM — included only for TEAM scope
  if (ctx.effectiveScope === PermissionScope.TEAM && config.team) {
    const teamIds = ctx.teamIds ?? [];
    if (teamIds.length > 0) {
      conditions.push(config.team(teamIds));
    }
  }

  return { OR: conditions };
}

/**
 * Merges scope filter into an existing Prisma `where` clause.
 *
 * By default reads scope context from AsyncLocalStorage (set by ScopeResolutionGuard).
 * Pass `overrideCtx` to use an explicit scope context instead — required when the
 * route's permission module differs from the model being queried (cross-model access checks).
 *
 * Returns the original `where` unchanged when:
 * - No scope context exists (public routes, workers) and no overrideCtx provided
 * - Scope is ALL
 * - Model has no registered scope config
 *
 * @param model - Prisma model name in PascalCase (e.g. `'Case'`).
 * @param where - Existing Prisma `where` clause to merge scope into.
 * @param overrideCtx - Explicit scope context; bypasses AsyncLocalStorage when provided.
 */
export function withScope<T extends Record<string, unknown>>(
  model: string,
  where: T,
  overrideCtx?: IScopeContext,
): T {
  const ctx = overrideCtx ?? getScopeContext();
  if (!ctx) return where;

  const config = SCOPE_CONFIGS.get(model);
  if (!config) return where;

  const scopeFilter = buildScopeFilter(config, ctx);
  if (!scopeFilter) return where;

  let existingAnd: unknown[];
  if (Array.isArray(where.AND)) {
    existingAnd = where.AND;
  } else if (where.AND) {
    existingAnd = [where.AND];
  } else {
    existingAnd = [];
  }

  return { ...where, AND: [...existingAnd, scopeFilter] } as T;
}
