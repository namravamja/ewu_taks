import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Class-level decorator: when `primary` is defined, none of `exclusive` may be defined.
 * Defining `primary` alone, or any combination of `exclusive` without `primary`, is allowed.
 *
 * @example
 * ```typescript
 * @MutuallyExclusiveWith('sessionId', ['caseId', 'folderUuid'])
 * export class StartSessionDTO { ... }
 * ```
 */
export function MutuallyExclusiveWith(
  primary: string,
  exclusive: string[],
  validationOptions?: ValidationOptions,
) {
  return function (target: new (...args: unknown[]) => object): void {
    registerDecorator({
      name: 'mutuallyExclusiveWith',
      target,
      propertyName: `_mutuallyExclusiveWith_${primary}`,
      constraints: [primary, exclusive],
      options: {
        message: `${exclusive.join(', ')} cannot be combined with ${primary}`,
        ...validationOptions,
      },
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const [primaryKey, exclusiveKeys] = args.constraints as [string, string[]];
          const obj = args.object as Record<string, unknown>;
          // eslint-disable-next-line security/detect-object-injection -- key is from decorator constraints, not user input
          if (obj[primaryKey] === undefined) return true;
          // eslint-disable-next-line security/detect-object-injection -- key is from decorator constraints, not user input
          return exclusiveKeys.every((key) => obj[key] === undefined);
        },
      },
    });
  };
}
