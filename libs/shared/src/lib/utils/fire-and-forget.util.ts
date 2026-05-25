/**
 * Executes a promise without awaiting it, logging a warning on failure.
 *
 * Use instead of `.catch(() => {})` so that fire-and-forget failures
 * remain observable in logs rather than being silently swallowed.
 */
export function fireAndForget(
  promise: Promise<unknown>,
  logger: { warn(message: string, meta?: Record<string, unknown>): void },
  context: string,
): void {
  promise.catch((error: unknown) => {
    logger.warn(`Fire-and-forget failed: ${context}`, { error });
  });
}
