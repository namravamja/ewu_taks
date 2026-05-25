/**
 * Type guard: checks if a value is a plain JSON object (non-null, non-array).
 * Use instead of `as Record<string, unknown>` casts on Prisma JsonValue fields.
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Asserts that a value is a JSON object, throwing TypeError if not.
 * Use at trust boundaries where the value MUST be an object (e.g., tool call args).
 */
export function assertJsonObject(value: unknown, label = 'value'): Record<string, unknown> {
  if (!isJsonObject(value)) {
    let received: string;
    if (value === null) received = 'null';
    else if (Array.isArray(value)) received = 'array';
    else received = typeof value;

    throw new TypeError(`Expected ${label} to be a JSON object, received ${received}`);
  }
  return value;
}
