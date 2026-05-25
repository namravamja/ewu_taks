import { SENSITIVE_FIELDS } from '../logger.constants';

const sensitiveKeys = new Set<string>(SENSITIVE_FIELDS.map((f) => f.toLowerCase()));

const FIXED_MASK = '****';

// ─── PII email masking ──────────────────────────────────────────────────────

const EMAIL_KEY_PATTERN = /email/i;
/* eslint-disable security/detect-unsafe-regex -- bounded quantifiers prevent catastrophic backtracking */
const INLINE_EMAIL_RE =
  /[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}/g;
/* eslint-enable security/detect-unsafe-regex */

function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return maskValue(email);

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  if (local.length <= 2) return FIXED_MASK + domain;
  if (local.length <= 4) return local[0] + '***' + domain;
  return local[0] + '***' + local[local.length - 1] + domain;
}

function maskInlineEmails(str: string): string {
  return str.replace(INLINE_EMAIL_RE, (match) => maskEmail(match));
}

function maskValue(value: string): string {
  if (value.length < 8) {
    return FIXED_MASK;
  }
  return value.slice(0, 2) + FIXED_MASK + value.slice(-2);
}

const sensitiveKeysAlternation = [...sensitiveKeys]
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

// key=value — single token, stops at whitespace and query-string delimiters
// eslint-disable-next-line security/detect-non-literal-regexp
const CREDENTIAL_EQ_PATTERN = new RegExp(
  `(?:^|[\\s&?;,])(${sensitiveKeysAlternation})\\s*=\\s*[^\\s&?;,]+`,
  'gi',
);

// eslint-disable-next-line security/detect-non-literal-regexp
const CREDENTIAL_COLON_PATTERN = new RegExp(
  `(?:^|[\\s&?;,])(${sensitiveKeysAlternation})\\s*:\\s*[^\\n\\r,;]+`,
  'gi',
);

const MAX_DEPTH = 10;

export function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>, 0);
  }

  return value;
}

function sanitizeObject(obj: Record<string, unknown>, depth: number): Record<string, unknown> {
  if (depth >= MAX_DEPTH) {
    return { '[truncated]': 'max sanitization depth reached' };
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, val]) => {
      if (sensitiveKeys.has(key.toLowerCase())) {
        return [key, maskValue(String(val))];
      }

      if (EMAIL_KEY_PATTERN.test(key) && typeof val === 'string' && val.includes('@')) {
        return [key, maskEmail(val)];
      }

      if (val !== null && val !== undefined && typeof val === 'object') {
        const sanitized = Array.isArray(val)
          ? val.map((item) => sanitizeValue(item))
          : sanitizeObject(val as Record<string, unknown>, depth + 1);
        return [key, sanitized];
      }

      if (typeof val === 'string') {
        return [key, sanitizeString(val)];
      }

      return [key, val];
    }),
  );
}

function sanitizeUriCredentials(str: string): string {
  if (!str.includes('://')) {
    return str;
  }

  let result = '';
  let i = 0;

  while (i < str.length) {
    const idx = str.indexOf('://', i);
    if (idx === -1) {
      result += str.slice(i);
      break;
    }

    // Find the start of the scheme (word chars before ://)
    let schemeStart = idx;
    while (schemeStart > i && /\w/.test(str[schemeStart - 1])) {
      schemeStart--;
    }

    const afterScheme = idx + 3;
    const atIdx = str.indexOf('@', afterScheme);
    const colonIdx = str.indexOf(':', afterScheme);

    if (atIdx !== -1 && colonIdx !== -1 && colonIdx < atIdx) {
      // Found scheme://user:password@host pattern
      result += str.slice(i, colonIdx + 1) + FIXED_MASK + '@';
      i = atIdx + 1;
    } else {
      result += str.slice(i, afterScheme);
      i = afterScheme;
    }
  }

  return result;
}

function replaceCredential(match: string): string {
  const leadingChar = /^[\s&?;,]/.exec(match);
  const leading = leadingChar ? leadingChar[0] : '';
  const core = leadingChar ? match.slice(1) : match;
  const separatorIndex = core.search(/[=:]/);
  const prefix = core.slice(0, separatorIndex + 1);
  const value = core.slice(separatorIndex + 1).trim();
  return `${leading}${prefix} ${maskValue(value)}`;
}

function sanitizeString(str: string): string {
  const eqMasked = str.replace(CREDENTIAL_EQ_PATTERN, replaceCredential);
  const colonMasked = eqMasked.replace(CREDENTIAL_COLON_PATTERN, replaceCredential);
  const uriMasked = sanitizeUriCredentials(colonMasked);
  return maskInlineEmails(uriMasked);
}
