/**
 * Converts a human-readable namespace string into a deterministic 32-bit
 * integer suitable for PostgreSQL `pg_advisory_xact_lock(key)`.
 *
 * Uses the DJB2 hash algorithm (fast, good distribution).
 *
 * @example
 * advisoryLockKey('pipeline_statuses:rebalance') // → stable int32
 */
export function advisoryLockKey(namespace: string): number {
  let hash = 5381;
  for (let i = 0; i < namespace.length; i++) {
    hash = ((hash << 5) + hash + namespace.charCodeAt(i)) | 0; // force int32
  }
  return hash;
}
