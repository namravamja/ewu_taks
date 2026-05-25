/**
 * `class-transformer` helpers for HTTP query-string parameters.
 *
 * Use these as the implementation for `@Transform(...)` on DTO fields. They
 * normalise the variations a client may send (single value vs repeat-style
 * vs comma-separated) into a predictable shape that `class-validator`
 * decorators can then validate.
 */

interface TransformParams {
  readonly value: unknown;
}

/**
 * Tri-state boolean parser for query params that accept `true` / `false`
 * with `undefined` meaning "no filter".
 *
 * Returns `true` / `false` for the literal strings or booleans; otherwise
 * passes the value through so `@IsBoolean()` can reject invalid input.
 */
export const parseTriStateBoolean = ({ value }: TransformParams): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/**
 * Splits a comma-separated query value into a deduplicated array of trimmed
 * strings. Handles both shapes a client may send:
 *
 *  - repeat-style: `?key=a&key=b`     → received as `['a', 'b']`
 *  - comma-style:  `?key=a,b`          → received as `'a,b'`
 *  - mixed:        `?key=a,b&key=c`    → received as `['a,b', 'c']`
 *
 * Empty/whitespace-only entries are dropped consistently across both branches.
 * Non-string/non-array values pass through unchanged so downstream validators
 * (e.g. `@IsArray()`) can reject them.
 */
export const splitCsv = ({ value }: TransformParams): unknown => {
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return value;
};
