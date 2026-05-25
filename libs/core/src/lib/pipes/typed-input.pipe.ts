import {
  ArgumentMetadata,
  Injectable,
  InternalServerErrorException,
  PipeTransform,
} from '@nestjs/common';

/**
 * Global pipe that enforces every @Body() and @Query() parameter is backed by a
 * typed DTO class. Without a concrete class, class-validator/class-transformer
 * cannot validate or coerce the value, leaving Prisma exposed to operator
 * injection (e.g. `{ "password": { "not": "" } }`).
 *
 * Throws InternalServerErrorException (500) — a developer mistake, not a bad
 * request — so it surfaces immediately in dev and CI rather than silently
 * accepting unsafe input.
 *
 * Metatype erasure notes:
 * - Untyped / `object` / `Object` / `Record<K,V>` → erased to `Object` at runtime.
 * - `any[]` / `unknown[]` / `CreateDTO[]` → ALL erase to `Array` at runtime.
 *   Since we cannot distinguish unsafe from safe array types here, array safety
 *   is enforced statically by the `no-untyped-nestjs-decorators` ESLint rule
 *   (which recurses into TSArrayType element types) rather than at runtime.
 *
 * Register BEFORE ValidationPipe in main.ts so untyped params are caught first.
 */
@Injectable()
export class TypedInputPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (
      (metadata.type === 'body' || metadata.type === 'query') &&
      (!metadata.metatype || metadata.metatype === Object)
    ) {
      const decorator = metadata.type === 'body' ? '@Body()' : '@Query()';
      throw new InternalServerErrorException(
        `Untyped ${decorator} parameter — provide a DTO class to prevent operator injection`,
      );
    }
    return value;
  }
}
