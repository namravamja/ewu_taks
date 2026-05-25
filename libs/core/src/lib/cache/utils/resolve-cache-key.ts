export type CacheKeyOption = string | ((...args: unknown[]) => string);

export function resolveCacheKey(
  key: CacheKeyOption | undefined,
  methodName: string,
  args: unknown[],
): string {
  if (typeof key === 'function') {
    return key(...args);
  }
  if (typeof key === 'string') {
    return key;
  }
  return `${methodName}:${JSON.stringify(args)}`;
}
