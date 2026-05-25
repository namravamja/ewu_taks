import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function Match(property: string, validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName: String(propertyName),
      constraints: [property],
      options: {
        message: `$property must match ${property}`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as [string];
          // eslint-disable-next-line security/detect-object-injection -- key is from decorator constraints, not user input
          const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];
          return value === relatedValue;
        },
      },
    });
  };
}
