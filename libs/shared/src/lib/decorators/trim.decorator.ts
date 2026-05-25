import { Transform, type TransformFnParams } from 'class-transformer';

export interface TrimOptions {
  /**
   * When true, an empty string after trimming becomes `null`.
   * Useful for optional fields where empty input should clear the value.
   */
  toNull?: boolean;
}

/**
 * Property decorator that trims surrounding whitespace from string values
 * before validation runs. Non-string values pass through unchanged so
 * downstream validators (`@IsString()`, `@IsOptional()`) report accurate errors.
 *
 * Use BEFORE `@IsNotEmpty()` / `@MinLength()` so whitespace-only strings are
 * rejected by the existing validators rather than silently accepted.
 */
export function Trim(options: TrimOptions = {}): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (options.toNull && trimmed.length === 0) return null;
    return trimmed;
  });
}
