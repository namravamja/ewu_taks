export function buildSortBy<T extends string>(
  sortBy: T | undefined,
  allowedFields: readonly T[],
  defaultField: NoInfer<T>,
): T {
  if (sortBy && (allowedFields as readonly string[]).includes(sortBy)) {
    return sortBy;
  }
  return defaultField;
}
