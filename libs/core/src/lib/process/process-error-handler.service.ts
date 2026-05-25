import type { INestApplication } from '@nestjs/common';
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import { AppLoggerService } from '../logger/logger.service';

/**
 * True when `value` (or anything in its `.cause` chain, up to a small depth)
 * looks like an `AbortError`. Covers both `DOMException('...', 'AbortError')`
 * produced by `AbortController.abort()` and plain `Error` objects whose
 * `name === 'AbortError'` (Node `node:fetch` / some AWS SDK transports).
 *
 * Walking the cause chain is required because Bedrock/langchain frequently
 * wraps the original abort in a generic error before it surfaces to
 * process-level listeners.
 */
function isAbortError(value: unknown): boolean {
  for (let cursor: unknown = value, hops = 0; hops < 5 && cursor != null; hops++) {
    if (typeof cursor !== 'object') return false;
    if ((cursor as { name?: unknown }).name === 'AbortError') return true;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Owns the `unhandledRejection` / `uncaughtException` process listeners.
 *
 * Why this exists: when {@link AbortController.abort} fires inside a stream
 * we hand to Bedrock / LangChain / LangGraph, the SDK's own signal listeners
 * sometimes reject internal Promises we never receive — the iterator path
 * we await is already handled, but those side-channel rejections still
 * bubble out to the process. Node 24 promotes any unhandled rejection to
 * `uncaughtException`, which would otherwise crash the pod on every user-stop.
 *
 * We cannot fix this at the source without patching the SDK; the rejected
 * Promise is detached, so a try/catch around `abort()` does not see it.
 *
 * What this does instead:
 * - Recognize AbortError-shaped rejections (walks the `.cause` chain) and
 *   downgrade them to a warn-level log. The orchestrator's iterator catch
 *   already handled the cancellation correctly — these are benign byproducts.
 * - Treat everything else as a fatal fault: log, then close the Nest app
 *   so DB pools / Redis / Bedrock streams shut down cleanly, then exit 1.
 *
 * Lifecycle:
 * - `onApplicationBootstrap` installs the listeners.
 * - `onApplicationShutdown` removes them — important when the app is being
 *   torn down (e.g. integration tests creating multiple Nest contexts) so
 *   the listeners don't accumulate.
 * - `bindApp` is called by the bootstrap entrypoint right after the Nest app
 *   is created so the handler can call `app.close()` on a fatal exit. The
 *   service is functional before `bindApp` is invoked — fatal exits without
 *   an app reference fall back to a direct `process.exit(1)`.
 */
@Injectable()
export class ProcessErrorHandlerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private app: INestApplication | null = null;
  private shuttingDown = false;
  private unhandledRejectionListener?: (reason: unknown) => void;
  private uncaughtExceptionListener?: (error: Error) => void;

  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(ProcessErrorHandlerService.name);
  }

  bindApp(app: INestApplication): void {
    this.app = app;
  }

  onApplicationBootstrap(): void {
    this.unhandledRejectionListener = (reason: unknown): void => {
      if (isAbortError(reason)) {
        this.logger.warn('Suppressed AbortError unhandled rejection', {
          message: (reason as { message?: string }).message,
        });
        return;
      }
      this.logger.error(
        'Unhandled promise rejection — shutting down',
        reason instanceof Error ? reason : new Error(String(reason)),
      );
      this.shutdown(1, reason).catch(() => undefined);
    };
    this.uncaughtExceptionListener = (error: Error): void => {
      if (isAbortError(error)) {
        this.logger.warn('Suppressed AbortError uncaughtException', {
          message: error.message,
        });
        return;
      }
      this.logger.error('Uncaught exception — shutting down', error);
      this.shutdown(1, error).catch(() => undefined);
    };
    process.on('unhandledRejection', this.unhandledRejectionListener);
    process.on('uncaughtException', this.uncaughtExceptionListener);
  }

  onApplicationShutdown(): void {
    if (this.unhandledRejectionListener) {
      process.off('unhandledRejection', this.unhandledRejectionListener);
      this.unhandledRejectionListener = undefined;
    }
    if (this.uncaughtExceptionListener) {
      process.off('uncaughtException', this.uncaughtExceptionListener);
      this.uncaughtExceptionListener = undefined;
    }
  }

  private async shutdown(exitCode: number, originalError: unknown): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    if (!this.app) {
      process.exit(exitCode);
      return;
    }
    try {
      await this.app.close();
    } catch (closeError) {
      this.logger.error('Nest app.close() failed during shutdown', {
        closeError: closeError instanceof Error ? closeError.message : String(closeError),
        originalError:
          originalError instanceof Error ? originalError.message : String(originalError),
      });
    } finally {
      process.exit(exitCode);
    }
  }
}
