import { hostname } from 'node:os';

import * as winston from 'winston';

import { sanitizeValue } from '../sanitizers/credential.sanitizer';

const host = hostname();

export function productionFormat(serviceName: string): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => {
      const { timestamp, level, message, context, correlationId, service, stack, ...metadata } =
        info;

      const sanitized = sanitizeValue(metadata) as Record<string, unknown>;

      // Remove all metadata keys, then assign structured fields.
      // Winston requires returning the same `info` reference (carries internal Symbol keys),
      // so we clear and reassign rather than creating a new object.
      for (const key of Object.keys(metadata)) {
        Reflect.deleteProperty(info, key);
      }

      return Object.assign(info, {
        timestamp,
        level,
        message,
        context,
        correlationId,
        service: service ?? serviceName,
        hostname: host,
        ...(stack ? { stack } : {}),
        ...(Object.keys(sanitized).length > 0 ? { metadata: sanitized } : {}),
      });
    })(),
    winston.format.json(),
  );
}
