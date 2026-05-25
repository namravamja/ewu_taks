import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function DisjointIdArrays(
  firstKey: string,
  secondKey: string,
  validationOptions?: ValidationOptions,
) {
  return function (target: new (...args: unknown[]) => object): void {
    registerDecorator({
      name: 'disjointIdArrays',
      target,
      propertyName: `_disjointIdArrays_${firstKey}_${secondKey}`,
      constraints: [firstKey, secondKey],
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const [a, b] = args.constraints as [string, string];
          const obj = args.object as Record<string, unknown>;
          // eslint-disable-next-line security/detect-object-injection
          const first = obj[a];
          // eslint-disable-next-line security/detect-object-injection
          const second = obj[b];
          if (!Array.isArray(first) || !Array.isArray(second)) return true;
          if (first.length === 0 || second.length === 0) return true;
          const set = new Set(first);
          return !second.some((id) => set.has(id));
        },
        defaultMessage(args: ValidationArguments): string {
          const [a, b] = args.constraints as [string, string];
          const obj = args.object as Record<string, unknown>;
          // eslint-disable-next-line security/detect-object-injection
          const first = (obj[a] as unknown[] | undefined) ?? [];
          // eslint-disable-next-line security/detect-object-injection
          const second = (obj[b] as unknown[] | undefined) ?? [];
          const set = new Set(first);
          const overlap = second.filter((id) => set.has(id));
          return `${a} and ${b} must not contain overlapping ids; got [${overlap.join(', ')}]`;
        },
      },
    });
  };
}
