export const APP_NAME = 'ewu-media-backend';

export { AUDIT_SEVERITY_MAP } from './audit-severity-map';

export const CORRELATION_HEADER = 'X-Correlation-ID';

export const IS_PUBLIC_KEY = 'isPublic';

export const ALLOW_PENDING_KEY = 'allowPending';

export const TIMEOUT_MS = 30_000;

export const SALT_ROUNDS = 12;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const CURSOR_PAGINATION_DEFAULTS = {
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

export const DEFAULT_CACHE_TTL = 300;

export const LRU_MAX_ENTRIES = 1000;

export const PERMISSIONS_KEY = 'permissions';

export const THROTTLE_TIER_KEY = 'throttleTier';

export const THROTTLE_TIERS = {
  GLOBAL: 'global',
  AUTH: 'auth',
  OTP: 'otp',
  UPLOAD: 'upload',
  PUBLIC: 'public',
  REGISTRATION: 'registration',
  AI_TURN: 'aiTurn',
} as const;

export type ThrottleTierName = (typeof THROTTLE_TIERS)[keyof typeof THROTTLE_TIERS];

export const THROTTLE_TIER_DEFAULTS: Record<ThrottleTierName, { limit: number; ttl: number }> = {
  [THROTTLE_TIERS.GLOBAL]: { limit: 250, ttl: 60_000 },
  [THROTTLE_TIERS.AUTH]: { limit: 10, ttl: 900_000 },
  [THROTTLE_TIERS.OTP]: { limit: 1, ttl: 60_000 },
  [THROTTLE_TIERS.UPLOAD]: { limit: 30, ttl: 3_600_000 },
  [THROTTLE_TIERS.PUBLIC]: { limit: 60, ttl: 60_000 },
  [THROTTLE_TIERS.REGISTRATION]: { limit: 5, ttl: 3_600_000 },
  [THROTTLE_TIERS.AI_TURN]: { limit: 60, ttl: 3_600_000 },
};

export const ROLE_HIERARCHY_KEY = 'roleHierarchy';

export const ROLE_ENTITY_HIERARCHY_KEY = 'roleEntityHierarchy';

export const SCOPE_GUARD_KEY = 'scopeGuard';

export const SELF_ACTION_KEY = 'selfAction';

export const SKIP_TWO_FACTOR_ENFORCEMENT_KEY = 'skipTwoFactorEnforcement';

export const REQUIRES_ROLE_KEY = 'requiresRole';

export const COMMENT_DEFAULTS = {
  MAX_DEPTH: 1,
  REPLIES_PREVIEW: 3,
  MAX_MENTIONS: 50,
  NOTIFY_BATCH_SIZE: 100,
  IDEMPOTENCY_TTL_SEC: 600,
  MAX_CONTENT_LENGTH: 500,
} as const;

export const UNDO_TOKEN_TTL_SECONDS = 30;

export const SYSTEM_BOT_EMAIL = 'system@ewumedia.internal';
