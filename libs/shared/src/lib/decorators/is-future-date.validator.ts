import { registerDecorator, type ValidationOptions } from 'class-validator';

export function IsFutureDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message: `${propertyName as string} must be a date in the future`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return true;
          const date = new Date(value);
          if (isNaN(date.getTime())) return true;
          return date.getTime() > Date.now();
        },
      },
    });
  };
}
