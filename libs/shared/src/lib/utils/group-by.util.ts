/**
 * Groups an array of items into a `Map` keyed by the result of `keyFn`.
 *
 * Returns an empty map for empty input arrays.
 */
export function groupByKey<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push(item);
  }
  return map;
}
