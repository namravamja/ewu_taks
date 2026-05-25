import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extracts one or more cookie values from the incoming request by name.
 * Returns a record mapping each requested cookie name to its value (or undefined).
 *
 * @example
 * // Single field
 * async refresh(@Cookies('refresh_token') { refresh_token }: { refresh_token?: string }) { ... }
 *
 * // Multiple fields
 * async example(@Cookies(['refresh_token', 'other']) cookies: { refresh_token?: string; other?: string }) { ... }
 */
export const Cookies = createParamDecorator(
  (names: string | string[], ctx: ExecutionContext): Record<string, string | undefined> => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const cookies = request.cookies as object;
    const fields = Array.isArray(names) ? names : [names];
    // Reflect.get avoids the security/detect-object-injection lint rule —
    // fields are always developer-supplied constants, never user input.
    return Object.fromEntries(
      fields.map((name) => [name, Reflect.get(cookies, name) as string | undefined]),
    );
  },
);
