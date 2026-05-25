import { PermissionScope } from '@mediastar/core';

// ─── JWT ─────────────────────────────────────────────────────────────────────

export const JWT_ISSUER = 'ewu-media-api';
export const JWT_AUDIENCE = 'ewu-media-api';

// ─── Cookie name resolution ──────────────────────────────────────────────────

/**
 * Resolves the correct cookie name constant for the current `NODE_ENV`.
 *
 * - `development` / `test` → dev name (no prefix)
 * - `staging`              → staging name (`__Secure-ewu.stage.*`)
 * - `production`           → production name (`__Secure-ewu.*`)
 */
export function resolveCookieName(nodeEnv: string, dev: string, stg: string, prod: string): string {
  if (nodeEnv === 'production') return prod;
  if (nodeEnv === 'development' || nodeEnv === 'test') return dev;
  // Any unrecognised NODE_ENV (e.g. "staging") defaults to the secure staging name
  return stg;
}

// ─── Refresh cookie ───────────────────────────────────────────────────────────

/** Refresh-token cookie name used in development (no prefix — no HTTPS required). */
export const REFRESH_COOKIE_NAME_DEV = 'refresh_token';

/** Refresh-token cookie name used in staging (`__Secure-` prefix with `.stage` discriminator). */
export const REFRESH_COOKIE_NAME_STG = '__Secure-ewu.stage.rt';

/** Refresh-token cookie name used in production (`__Secure-` prefix, requires HTTPS). */
export const REFRESH_COOKIE_NAME_PROD = '__Secure-ewu.rt';

export const REFRESH_COOKIE_PATH = '/api/auth/refresh';

// ─── Access token cookie ─────────────────────────────────────────────────────

export const ACCESS_TOKEN_COOKIE_NAME_DEV = 'ewu_at';
export const ACCESS_TOKEN_COOKIE_NAME_STG = '__Secure-ewu.stage.at';
export const ACCESS_TOKEN_COOKIE_NAME_PROD = '__Secure-ewu.at';
export const ACCESS_TOKEN_COOKIE_PATH = '/';

// ─── Login & lockout ─────────────────────────────────────────────────────────

/** Maximum failed login attempts before the account is temporarily locked. */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Base lockout duration (ms) after the first set of MAX_LOGIN_ATTEMPTS failures. */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** Maximum lockout duration (ms) after repeated lockouts. Prevents exponential blow-up. */
export const MAX_LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Token TTLs ───────────────────────────────────────────────────────────────

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** How long (ms) a password-reset link remains valid. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Minimum gap (ms) between consecutive forgot-password requests for the same account. */
export const RESET_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

/** How long (ms) a 2FA recovery link remains valid. */
export const TWO_FACTOR_RECOVERY_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Minimum gap (ms) between consecutive 2FA recovery requests for the same account. */
export const TWO_FACTOR_RECOVERY_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

/** Fallback refresh-token lifetime (ms) used when the config value cannot be parsed. */
export const FALLBACK_REFRESH_MS = 7 * 86_400_000; // 7 days

// ─── Validation ───────────────────────────────────────────────────────────────

/** Allowed characters for a username handle. */
export const USERNAME_REGEX = /^[A-Za-z0-9 _@#%!&-]*$/;

// ─── RBAC cache ───────────────────────────────────────────────────────────────

/**
 * Numeric rank for each permission scope used when comparing granted vs required scope.
 * Higher rank = broader access.
 */
export const RBAC_SCOPE_HIERARCHY: ReadonlyMap<PermissionScope, number> = new Map([
  [PermissionScope.ALL, 4],
  [PermissionScope.TEAM, 3],
  [PermissionScope.ASSIGNED, 2],
  [PermissionScope.OWN, 1],
]);

/** How long (ms) a role's permission set stays in the in-process cache. */
export const RBAC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum number of roles kept in the in-process LRU cache. */
export const RBAC_CACHE_MAX_SIZE = 100;

/** Redis pub/sub channel used to broadcast RBAC cache invalidation across instances. */
export const RBAC_PUBSUB_CHANNEL = 'rbac:invalidate';

/** Redis key holding the monotonic invalidation version counter. */
export const RBAC_INVALIDATION_VERSION_KEY = 'rbac:inv:version';

/** How often (ms) each instance polls the Redis version key as a pub/sub fallback. */
export const RBAC_SWEEP_INTERVAL_MS = 30_000; // 30 seconds

/** Maximum publish retry attempts before falling back to sweep-only. */
export const RBAC_PUBLISH_MAX_RETRIES = 1;

/** Delay in ms before retrying a failed RBAC publish. */
export const RBAC_PUBLISH_RETRY_DELAY_MS = 100;

// ─── User role cache (used by RoleHierarchyGuard) ───────────────────────────

/** How long (seconds) a user's role level stays cached before re-fetching from DB. */
export const USER_ROLE_CACHE_TTL = 30;

/** Key prefix for user role cache entries. Full key: `user-role:{userId}`. */
export const USER_ROLE_CACHE_PREFIX = 'user-role';

// ─── Team membership cache (used by ScopeResolutionGuard) ───────────────────

/** How long (seconds) a user's team membership stays cached before re-fetching from DB. */
export const TEAM_MEMBERSHIP_CACHE_TTL = 60;

/** Key prefix for team membership cache entries. Full key: `team-membership:{userId}`. */
export const TEAM_MEMBERSHIP_CACHE_PREFIX = 'team-membership';

// ─── Concurrent sessions ────────────────────────────────────────────────────

/** Maximum number of active sessions a user may hold simultaneously. */
export const MAX_CONCURRENT_SESSIONS = 4;

/** How long the session-management JWT (used to resolve a 409 session conflict) remains valid. */
export const SESSION_MGMT_TOKEN_EXPIRY = '2m';

/** Redis lock key prefix for session-limit enforcement. Full key: `session-limit-lock:{userId}`. */
export const SESSION_LIMIT_LOCK_PREFIX = 'session-limit-lock';

/** How long (seconds) the session-limit lock is held before auto-expiring. */
export const SESSION_LIMIT_LOCK_TTL_SECONDS = 10;

/** Key prefix for consumed session-management tokens. Full key: `session-mgmt-consumed:{tokenHash}`. */
export const SESSION_MGMT_CONSUMED_PREFIX = 'session-mgmt-consumed';

// ─── Session cache ───────────────────────────────────────────────────────────

/** How long (seconds) a session stays in the Redis/LRU cache before re-fetching from DB. */
export const SESSION_CACHE_TTL = 60;

/** Key prefix for session cache entries. Full key: `session:{userId}:{sessionId}`. */
export const SESSION_CACHE_PREFIX = 'session';

// ─── SSO authorization code ──────────────────────────────────────────────────

/** Key prefix for SSO one-time authorization codes. Full key: `sso-code:{code}`. */
export const SSO_CODE_CACHE_PREFIX = 'sso-code';

/** How long (seconds) a one-time SSO authorization code remains valid. */
export const SSO_CODE_TTL_SECONDS = 30;

/** Key prefix for SSO session-conflict one-time codes. Full key: `sso-conflict:{code}`. */
export const SSO_CONFLICT_CACHE_PREFIX = 'sso-conflict';

/** How long (seconds) a one-time SSO session-conflict code remains valid. */
export const SSO_CONFLICT_TTL_SECONDS = 120;

// ─── HTTP headers ────────────────────────────────────────────────────────────

export const USER_AGENT_HEADER = 'user-agent';

export const TWO_FACTOR_TOKEN_HEADER = 'x-two-factor-token';

// ─── Swagger helpers ─────────────────────────────────────────────────────────

export const VALIDATION_ERROR_DESC = 'Validation error';
export const INVALID_CODE_DESC = 'Invalid verification code';

// ─── Two-factor grace period ──────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000;

/** Computes the grace-period end date from a duration in hours. */
export function computeGracePeriodEnd(hours: number): Date {
  return new Date(Date.now() + hours * MS_PER_HOUR);
}

// ─── Two-factor defaults (must match Joi validation defaults) ────────────────

export const DEFAULT_TWO_FACTOR_MAX_ATTEMPTS = 5;
export const DEFAULT_TWO_FACTOR_LOCKOUT_MS = 900_000;
export const DEFAULT_TWO_FACTOR_TOKEN_EXPIRY = '5m';
export const DEFAULT_TWO_FACTOR_TRUSTED_DEVICE_TTL_MS = 2_592_000_000;
export const DEFAULT_TWO_FACTOR_BACKUP_CODE_COUNT = 10;
export const DEFAULT_TWO_FACTOR_TOTP_ISSUER = 'EWU Media';
export const DEFAULT_TWO_FACTOR_TOTP_WINDOW = 1;

/** Key prefix for consumed two-factor tokens. Full key: `2fa-consumed:{tokenHash}`. */
export const TWO_FACTOR_CONSUMED_PREFIX = '2fa-consumed';

/** Cookie name for the trusted device token in development (no prefix). */
export const TRUSTED_DEVICE_COOKIE_NAME_DEV = 'trusted_device';

/** Cookie name for the trusted device token in staging (`__Secure-` prefix with `.stage` discriminator). */
export const TRUSTED_DEVICE_COOKIE_NAME_STG = '__Secure-ewu.stage.td';

/** Cookie name for the trusted device token in production (`__Secure-` prefix). */
export const TRUSTED_DEVICE_COOKIE_NAME_PROD = '__Secure-ewu.td';

/** Cookie path for the trusted device token. */
export const TRUSTED_DEVICE_COOKIE_PATH = '/api/auth';

// ─── Config keys ─────────────────────────────────────────────────────────────

/** Config key for the frontend base URL (used for email links). */
export const FRONTEND_URL_KEY = 'app.frontendUrl';

// ─── Provider switch ────────────────────────────────────────────────────────

/** How long (ms) a set-password link remains valid after an auth-provider switch. */
export const SET_PASSWORD_TOKEN_TTL_MS = ONE_DAY_MS;

/** How long (ms) a breakglass / emergency-access link remains valid. */
export const BREAKGLASS_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Maximum provider-switch operations allowed within the rate-limit window. */
export const PROVIDER_SWITCH_RATE_LIMIT = 5;

/** Rate-limit window (ms) for provider-switch operations per user. */
export const PROVIDER_SWITCH_WINDOW_MS = 60 * 60 * 1000; // 1 hour
