import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Rejects strings whose UTF-8 byte length exceeds `maxBytes`.
 *
 * `class-validator`'s built-in `@MaxLength` checks `String.length` (UTF-16
 * code units), which under-counts multi-byte characters: a 9MB string of
 * 3-byte BMP chars would pass `@MaxLength(9MB)` but encode to 27MB UTF-8.
 * Use this decorator on body fields that downstream get fed to a byte-bounded
 * sink (e.g., SES's 28MB pre-base64 message cap).
 *
 * Skips non-string values so it composes with `@IsString()` and `@IsOptional()`.
 */
export function IsMaxByteLength(
  maxBytes: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isMaxByteLength',
      target: object.constructor,
      propertyName: propertyName as string,
      constraints: [maxBytes],
      options: {
        message: `${propertyName as string} must be at most ${maxBytes} bytes (UTF-8)`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return true;
          return Buffer.byteLength(value, 'utf8') <= maxBytes;
        },
      },
    });
  };
}
