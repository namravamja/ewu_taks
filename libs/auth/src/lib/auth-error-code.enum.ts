import { UnauthorizedException } from '@nestjs/common';

/**
 * Structured UPPER_SNAKE_CASE error codes returned to the frontend.
 * The frontend maps these codes to user-facing messages.
 */
export enum AuthErrorCode {
  // ── Client-facing codes ─────────────────────────────────────────────────
  PENDING = 'PENDING',
  CONTACT_ADMINISTRATOR = 'CONTACT_ADMINISTRATOR',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  AUTH_FAILED = 'AUTH_FAILED',
  MAX_SESSIONS_REACHED = 'MAX_SESSIONS_REACHED',

  // ── Internal codes (logging only) ───────────────────────────────────────
  // → maps to CONTACT_ADMINISTRATOR when sent to the client
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
  DELETED = 'DELETED',
  INVITED = 'INVITED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  CREDENTIALS_DISABLED = 'CREDENTIALS_DISABLED',
  EMAIL_ALREADY_REGISTERED = 'EMAIL_ALREADY_REGISTERED',
  REVOKED = 'REVOKED',
}

/** Human-readable messages for client-facing auth error codes. */
const AUTH_ERROR_MESSAGES = new Map<AuthErrorCode, string>([
  [AuthErrorCode.INVALID_CREDENTIALS, 'Invalid email or password'],
  [AuthErrorCode.PENDING, 'Your account is pending approval'],
  [AuthErrorCode.CONTACT_ADMINISTRATOR, 'Please contact your administrator'],
  [AuthErrorCode.AUTH_FAILED, 'Authentication failed'],
  [
    AuthErrorCode.MAX_SESSIONS_REACHED,
    'Maximum concurrent sessions reached. Please terminate an existing session.',
  ],
]);

/**
 * Returns the human-readable message for a client-facing auth error code.
 * Falls back to a generic message if the code has no mapping.
 */
export function getAuthErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES.get(code) ?? 'Authentication failed';
}

/**
 * Creates a structured UnauthorizedException with a consistent response shape:
 * `{ message: "Human-readable text", data: { code: "AUTH_ERROR_CODE" } }`
 *
 * Internal codes (REJECTED, SUSPENDED, etc.) are mapped to their client-facing
 * equivalents via `toClientAuthErrorCode()`.
 */
export function createAuthError(code: AuthErrorCode): UnauthorizedException {
  const clientCode = toClientAuthErrorCode(code);
  return new UnauthorizedException({
    message: getAuthErrorMessage(clientCode),
    data: { code: clientCode },
  });
}

/** Maps an internal {@link AuthErrorCode} to the generic code sent to the client. */
export function toClientAuthErrorCode(code: AuthErrorCode): AuthErrorCode {
  switch (code) {
    case AuthErrorCode.REJECTED:
    case AuthErrorCode.SUSPENDED:
    case AuthErrorCode.INACTIVE:
    case AuthErrorCode.DELETED:
    case AuthErrorCode.ACCOUNT_LOCKED:
    case AuthErrorCode.CREDENTIALS_DISABLED:
    case AuthErrorCode.EMAIL_ALREADY_REGISTERED:
    case AuthErrorCode.INVITED:
    case AuthErrorCode.REVOKED:
      return AuthErrorCode.CONTACT_ADMINISTRATOR;
    default:
      return code;
  }
}
