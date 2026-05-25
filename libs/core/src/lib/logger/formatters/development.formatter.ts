import * as winston from 'winston';

import { sanitizeValue } from '../sanitizers/credential.sanitizer';

const clc = {
  green: (t: string): string => `\x1b[32m${t}\x1b[39m`,
  yellow: (t: string): string => `\x1b[33m${t}\x1b[39m`,
  red: (t: string): string => `\x1b[31m${t}\x1b[39m`,
  magenta: (t: string): string => `\x1b[35m${t}\x1b[39m`,
  cyan: (t: string): string => `\x1b[36m${t}\x1b[39m`,
  dim: (t: string): string => `\x1b[2m${t}\x1b[22m`,
};

const levelColors = new Map<string, (t: string) => string>([
  ['error', clc.red],
  ['warn', clc.yellow],
  ['info', clc.green],
  ['debug', clc.magenta],
  ['verbose', clc.cyan],
]);

export function developmentFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
      ({ timestamp, level, message, context, correlationId, stack, ...rest }) => {
        const colorFn = levelColors.get(level) ?? clc.green;
        const ts = clc.dim(String(timestamp));
        const lvl = colorFn(level.toUpperCase().padStart(7));
        const ctx = context ? ' ' + clc.yellow('[' + String(context) + ']') : '';
        const cid =
          correlationId && correlationId !== 'N/A'
            ? ' ' + clc.dim('[corr:' + String(correlationId) + ']')
            : '';

        let line = ts + ' ' + lvl + ctx + cid + ' ' + String(message);

        const sanitized = sanitizeValue(rest) as Record<string, unknown>;
        const displayMeta = Object.fromEntries(
          Object.entries(sanitized).filter(([k]) => k !== 'service'),
        );

        const entries = Object.entries(displayMeta);
        if (entries.length > 0) {
          for (const [key, val] of entries) {
            let display: string;
            if (key === 'duration') {
              display = String(val) + 'ms';
            } else if (typeof val === 'object') {
              display = JSON.stringify(val);
            } else {
              display = String(val);
            }
            line += '\n  ' + clc.cyan('→') + ' ' + clc.cyan(key) + ': ' + display;
          }
        }

        if (stack) {
          line += `\n${String(stack)}`;
        }

        return line;
      },
    ),
  );
}
