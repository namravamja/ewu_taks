import 'reflect-metadata';

const SENSITIVE_FIELDS_KEY = Symbol('audit:sensitiveFields');

/**
 * Marks a DTO property as sensitive so that the audit interceptor
 * will redact its value when capturing request body changes.
 */
export function SensitiveField(): PropertyDecorator {
  return (target, propertyKey) => {
    const proto = target.constructor;
    const existing: Set<string> =
      Reflect.getOwnMetadata(SENSITIVE_FIELDS_KEY, proto) ?? new Set<string>();
    existing.add(String(propertyKey));
    Reflect.defineMetadata(SENSITIVE_FIELDS_KEY, existing, proto);
  };
}

/**
 * Retrieves the set of property names marked with `@SensitiveField()` on the given class.
 * Walks the prototype chain so that inherited sensitive fields are included.
 */
export function getSensitiveFields(cls: abstract new (...args: unknown[]) => unknown): Set<string> {
  const result = new Set<string>();
  let current: object | null = cls;

  while (current && current !== Function.prototype) {
    const fields: Set<string> | undefined = Reflect.getOwnMetadata(SENSITIVE_FIELDS_KEY, current);
    if (fields) {
      for (const f of fields) {
        result.add(f);
      }
    }
    current = Object.getPrototypeOf(current) as object | null;
  }

  return result;
}
