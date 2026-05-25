import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function IsNotBefore(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isNotBefore',
      target: object.constructor,
      propertyName: String(propertyName),
      constraints: [property],
      options: {
        message: `$property must not be before ${property}`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as [string];
          // eslint-disable-next-line security/detect-object-injection -- key is from decorator constraints, not user input
          const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];
          if (relatedValue === undefined || relatedValue === null) return true;
          if (typeof value !== 'string' || typeof relatedValue !== 'string') return false;
          return new Date(value).getTime() >= new Date(relatedValue).getTime();
        },
      },
    });
  };
}
