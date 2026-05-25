/**
 * Executes an async function over an array of items with bounded concurrency.
 * Results are returned in input order. Rejects on first error; no new items
 * start after the failure and in-flight calls are awaited (their results are
 * discarded). Pass the optional `signal` to `fn` so callers can check
 * `signal.aborted` at safe points to bail out of in-flight work early.
 */
export async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, signal: AbortSignal) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const ac = new AbortController();
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown;

  async function worker(): Promise<void> {
    while (!ac.signal.aborted && nextIndex < items.length) {
      const i = nextIndex++;
      const item = items.at(i) as T;
      try {
        const result = await fn(item, ac.signal);
        if (!ac.signal.aborted) {
          results[i] = result; // eslint-disable-line security/detect-object-injection -- i is a numeric index bounded by items.length
        }
      } catch (error) {
        if (!ac.signal.aborted) {
          firstError = error;
          ac.abort();
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());

  await Promise.allSettled(workers);
  if (firstError) throw firstError;
  return results;
}
