import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Class-level decorator that validates at least one of the specified properties is defined.
 *
 * @example
 * ```typescript
 * @AtLeastOneOf(['text', 'urls', 'files'])
 * export class SendAiMessageDTO { ... }
 * ```
 */
export function AtLeastOneOf(properties: string[], validationOptions?: ValidationOptions) {
  return function (target: new (...args: unknown[]) => object): void {
    registerDecorator({
      name: 'atLeastOneOf',
      target,
      propertyName: '_atLeastOneOf',
      constraints: [properties],
      options: {
        message: `At least one of the following must be provided: ${properties.join(', ')}`,
        ...validationOptions,
      },
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const [props] = args.constraints as [string[]];
          return props.some((prop) => {
            // eslint-disable-next-line security/detect-object-injection -- key is from decorator constraints, not user input
            const val = (args.object as Record<string, unknown>)[prop];
            return val !== undefined && val !== null && (!Array.isArray(val) || val.length > 0);
          });
        },
      },
    });
  };
}
