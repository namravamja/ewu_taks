import { z } from 'zod';

import { THROTTLE_TIER_DEFAULTS } from '../constants/index';

const rateLimitValidation = (
  tier: string,
  defaults: { limit: number; ttl: number },
): Record<string, z.ZodType> => ({
  [`RATE_LIMIT_${tier.toUpperCase()}_LIMIT`]: z.coerce
    .number()
    .int()
    .min(1)
    .default(defaults.limit),
  [`RATE_LIMIT_${tier.toUpperCase()}_TTL_MS`]: z.coerce
    .number()
    .int()
    .min(1000)
    .default(defaults.ttl),
});

const rateLimitSchemas = Object.fromEntries(
  Object.entries(THROTTLE_TIER_DEFAULTS).flatMap(([tier, defaults]) =>
    Object.entries(rateLimitValidation(tier, defaults)),
  ),
);

const coerceBoolean = z.preprocess((v) => v === 'true' || v === true, z.boolean());

const optionalUrl = z.url().or(z.literal('')).default('');

// ---------------------------------------------------------------------------
// Shared schema — needed by ALL apps (api, email-sync, email-classifier)
// ---------------------------------------------------------------------------

const DEPLOYED_ENVS = ['production', 'staging'] as const;
type DeployedEnv = (typeof DEPLOYED_ENVS)[number];
const isDeployedEnv = (env: string): env is DeployedEnv =>
  (DEPLOYED_ENVS as readonly string[]).includes(env);

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'staging', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_NAME: z.string().default('ewu-media-backend'),
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(10000),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),
  DATABASE_TX_MAX_WAIT_MS: z.coerce.number().int().min(0).default(2000),
  DATABASE_TX_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_ACCESS_KEY_ID: z.string().default(''),
  AWS_S3_SECRET_ACCESS_KEY: z.string().default(''),
  AWS_S3_BUCKET: z.string().default(''),
  AWS_S3_PRESIGNED_EXPIRY: z.coerce.number().int().min(60).default(3600),
  AWS_S3_PROFILE_IMAGE_PRESIGNED_EXPIRY: z.coerce
    .number()
    .int()
    .min(60)
    .max(604800)
    .default(604800),
  AWS_SES_ACCESS_KEY_ID: z.string().default(''),
  AWS_SES_SECRET_ACCESS_KEY: z.string().default(''),
  AWS_SES_FROM_EMAIL: z.string().default(''),
  AWS_SES_OUTBOUND_FROM_ALLOWLIST: z.string().default(''),
  AWS_SES_CONFIGURATION_SET: z.string().optional(),
  AWS_SQS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SQS_SECRET_ACCESS_KEY: z.string().default(''),
  AWS_SQS_ENDPOINT: optionalUrl,

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_TLS: coerceBoolean.default(false),

  SQS_EMAIL_CLASSIFY_URL: optionalUrl,
  BULLMQ_DEFAULT_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  BULLMQ_BACKOFF_TYPE: z.enum(['exponential', 'fixed']).default('exponential'),
  BULLMQ_BACKOFF_DELAY_MS: z.coerce.number().int().min(100).default(1000),
  BULLMQ_REMOVE_ON_COMPLETE: z.coerce.number().int().min(0).default(100),
  BULLMQ_REMOVE_ON_FAIL: z.coerce.number().int().min(0).default(500),

  BEDROCK_REGION: z.string().default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().default('anthropic.claude-sonnet-4-6'),
  BEDROCK_FALLBACK_MODEL_ID: z.string().default('anthropic.claude-3-5-sonnet-20241022-v2:0'),
  BEDROCK_CRITIC_MODEL_ID: z.string().default('anthropic.claude-3-5-sonnet-20241022-v2:0'),
  BEDROCK_COMPRESSOR_MODEL_ID: z.string().default('anthropic.claude-haiku-4-5-20251001-v1:0'),
  BEDROCK_EMBEDDING_MODEL_ID: z.string().default('cohere.embed-english-v4'),
  BEDROCK_ACCESS_KEY_ID: z.string().default(''),
  BEDROCK_SECRET_ACCESS_KEY: z.string().default(''),
  BEDROCK_LATENCY_OPTIMIZED: coerceBoolean.default(false),
  FIRECRAWL_API_URL: z.url().default('http://localhost:3002'),
  FIRECRAWL_API_KEY: z.string().default(''),
  FIRECRAWL_TIMEOUT_MS: z.coerce.number().int().min(1000).default(25_000),
  FIRECRAWL_BATCH_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60_000),
  FIRECRAWL_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
  FIRECRAWL_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(100).default(400),
  FIRECRAWL_SCRAPE_MAX_AGE_MS: z.coerce.number().int().min(0).default(86_400_000),
  CASE_AI_PREFETCH_USER_URLS: coerceBoolean.default(true),
  CASE_AI_PREFETCH_MAX_URLS: z.coerce.number().int().min(0).max(10).default(3),
  AI_SESSION_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  AI_MAX_FILES_PER_MESSAGE: z.coerce.number().int().min(1).max(20).default(5),
  AI_MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(500).default(50),
  AI_RATE_LIMIT_RPM: z.coerce.number().int().min(1).default(50),
  AI_RATE_LIMIT_TPM: z.coerce.number().int().min(0).default(0),
  AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  NOTIFICATION_TTL_DAYS: z.coerce.number().int().min(1).default(90),
  EMAIL_TRASH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  APP_PUBLIC_BASE_URL: optionalUrl,
  EMAIL_SHARE_LINK_ICON_URL: optionalUrl,

  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().int().min(1).max(65535).default(993),
  IMAP_TLS: z.coerce.boolean().default(true),
  IMAP_RECORD_USER: z.string().optional(),
  IMAP_RECORD_PASSWORD: z.string().optional(),
  IMAP_FOIA_USER: z.string().optional(),
  IMAP_FOIA_PASSWORD: z.string().optional(),
  IMAP_RETRY_INITIAL_DELAY_MS: z.coerce.number().int().min(100).default(1000),
  IMAP_RETRY_MAX_DELAY_MS: z.coerce.number().int().min(1000).default(60000),
  IMAP_RETRY_MULTIPLIER: z.coerce.number().min(1).default(2),
  IMAP_RETRY_JITTER_FACTOR: z.coerce.number().min(0).max(1).default(0.3),
  IMAP_RETRY_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
  IMAP_NOOP_INTERVAL_MS: z.coerce.number().int().min(5000).default(60000),
  IMAP_NOOP_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  IMAP_LOCK_TIMEOUT_MS: z.coerce.number().int().min(5000).default(60000),
  IMAP_OVERSIZE_THRESHOLD_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(10 * 1024 * 1024),

  PARSER_POOL_ENABLED: coerceBoolean.default(true),
  PARSER_POOL_MIN_THREADS: z.coerce.number().int().min(0).default(1),
  PARSER_POOL_MAX_THREADS: z.coerce.number().int().min(0).default(0),
  PARSER_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),

  EMAIL_SYNC_INTERVAL_MS: z.coerce.number().default(60000),
  EMAIL_SYNC_BATCH_SIZE: z.coerce.number().default(50),
  EMAIL_SYNC_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3002),

  EMAIL_CLASSIFIER_CONCURRENCY: z.coerce.number().default(5),
  CLASSIFIER_SPAM_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  CLASSIFIER_MODEL_VERSION: z.string().default('v1.0.0'),
  CLASSIFIER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  QUEUE_WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3003),

  EMAIL_SEND_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  EMAIL_SEND_BACKOFF_TYPE: z.enum(['exponential', 'fixed']).default('exponential'),
  EMAIL_SEND_BACKOFF_DELAY_MS: z.coerce.number().int().min(1000).default(30_000),

  HEALTH_HEAP_THRESHOLD_MB: z.coerce.number().int().min(1).default(512),
  HEALTH_RSS_THRESHOLD_MB: z.coerce.number().int().min(1).default(1024),
  HEALTH_DISK_THRESHOLD_PERCENT: z.coerce.number().min(0.01).max(1).default(0.95),
  HEALTH_DB_TIMEOUT_MS: z.coerce.number().int().min(100).default(1000),

  SEED_OWNER_EMAILS: z.string().default(''),
});

// ---------------------------------------------------------------------------
// API-only schema — extends shared with fields only the HTTP API needs
// ---------------------------------------------------------------------------

const apiEnvSchema = baseEnvSchema.extend({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  TWO_FACTOR_SECRET: z.string().min(32, 'TWO_FACTOR_SECRET must be at least 32 characters'),
  SESSION_MGMT_SECRET: z.string().min(32, 'SESSION_MGMT_SECRET must be at least 32 characters'),

  TOTP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TOTP_ENCRYPTION_KEY must be a 64-character hex string'),

  TWO_FACTOR_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  TWO_FACTOR_LOCKOUT_MS: z.coerce.number().int().min(1000).default(900_000),
  TWO_FACTOR_TOKEN_EXPIRY: z.string().default('5m'),
  TWO_FACTOR_TRUSTED_DEVICE_TTL_MS: z.coerce.number().int().min(1000).default(2_592_000_000),
  TWO_FACTOR_BACKUP_CODE_COUNT: z.coerce.number().int().min(1).default(10),
  TWO_FACTOR_TOTP_ISSUER: z.string().default('EWU Media'),
  TWO_FACTOR_TOTP_WINDOW: z.coerce.number().int().min(0).default(1),

  CORS_ORIGIN: z.url('CORS_ORIGIN must be a valid URI'),
  FRONTEND_URL: z.url('FRONTEND_URL must be a valid URI'),
  ALLOWED_FRONTEND_URLS: z.string().default(''),

  SWAGGER_USER: z.string().default(''),
  SWAGGER_PASSWORD: z.string().default(''),

  WS_PORT: z.coerce.number().default(3001),

  COOKIE_DOMAIN: z.string().default(''),

  RECAPTCHA_SECRET_KEY: z.string().min(1, 'RECAPTCHA_SECRET_KEY is required'),

  ...rateLimitSchemas,
});

// ---------------------------------------------------------------------------
// Shared refinements (apply to all apps)
// ---------------------------------------------------------------------------

type BaseEnvData = z.infer<typeof baseEnvSchema>;
type RefinementCtx = z.RefinementCtx;

function addCustomIssue(ctx: RefinementCtx, path: string, message: string): void {
  ctx.addIssue({ code: 'custom', path: [path], message });
}

function getEnvField<T>(data: T, field: keyof T): T[keyof T] {
  return Object.getOwnPropertyDescriptor(data, field)?.value as T[keyof T];
}

function validateAwsCredentialPair(
  data: BaseEnvData,
  ctx: RefinementCtx,
  accessKeyField: keyof BaseEnvData,
  secretKeyField: keyof BaseEnvData,
): void {
  if (getEnvField(data, accessKeyField) && !getEnvField(data, secretKeyField)) {
    addCustomIssue(
      ctx,
      secretKeyField,
      `${secretKeyField} is required when ${accessKeyField} is set`,
    );
  }
}

const SEED_OWNER_EMAILS_FIELD = 'SEED_OWNER_EMAILS';

function validateSeedOwnerEmails(data: BaseEnvData, ctx: RefinementCtx, isDeployed: boolean): void {
  const raw = data.SEED_OWNER_EMAILS;
  const entries = raw
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    if (isDeployed) {
      addCustomIssue(
        ctx,
        SEED_OWNER_EMAILS_FIELD,
        `${SEED_OWNER_EMAILS_FIELD} is required in production/staging (comma-separated bootstrap Owner emails)`,
      );
    }
    return;
  }

  const emailSchema = z.email();
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!emailSchema.safeParse(entry).success) {
      addCustomIssue(ctx, SEED_OWNER_EMAILS_FIELD, `Entry "${entry}" is not a valid email`);
      return;
    }
    const lower = entry.toLowerCase();
    if (seen.has(lower)) {
      addCustomIssue(ctx, SEED_OWNER_EMAILS_FIELD, `Duplicate email "${entry}"`);
      return;
    }
    seen.add(lower);
  }
}

function sharedRefinements(data: BaseEnvData, ctx: RefinementCtx): void {
  validateAwsCredentialPair(data, ctx, 'AWS_S3_ACCESS_KEY_ID', 'AWS_S3_SECRET_ACCESS_KEY');
  validateAwsCredentialPair(data, ctx, 'AWS_SES_ACCESS_KEY_ID', 'AWS_SES_SECRET_ACCESS_KEY');
  validateAwsCredentialPair(data, ctx, 'AWS_SQS_ACCESS_KEY_ID', 'AWS_SQS_SECRET_ACCESS_KEY');

  const isDeployed = isDeployedEnv(data.NODE_ENV);

  if (isDeployed && !data.REDIS_PASSWORD) {
    addCustomIssue(ctx, 'REDIS_PASSWORD', 'REDIS_PASSWORD is required in production/staging');
  }
}

// ---------------------------------------------------------------------------
// API-only refinements
// ---------------------------------------------------------------------------

type ApiEnvData = z.infer<typeof apiEnvSchema>;

const ALLOWED_URLS_ERROR =
  'ALLOWED_FRONTEND_URLS must be valid URLs (HTTPS required in production)';

function validateAllowedFrontendUrls(data: ApiEnvData, ctx: RefinementCtx, isProd: boolean): void {
  if (!data.ALLOWED_FRONTEND_URLS) return;

  const urls = data.ALLOWED_FRONTEND_URLS.split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        (isProd && parsed.protocol !== 'https:')
      ) {
        addCustomIssue(ctx, 'ALLOWED_FRONTEND_URLS', ALLOWED_URLS_ERROR);
        return;
      }
    } catch {
      addCustomIssue(ctx, 'ALLOWED_FRONTEND_URLS', ALLOWED_URLS_ERROR);
      return;
    }
  }
}

function apiRefinements(data: ApiEnvData, ctx: RefinementCtx): void {
  const isDeployed = isDeployedEnv(data.NODE_ENV);
  const isProd = data.NODE_ENV === 'production';

  validateSeedOwnerEmails(data, ctx, isDeployed);

  if (isDeployed && !data.FRONTEND_URL.startsWith('https://')) {
    addCustomIssue(ctx, 'FRONTEND_URL', 'FRONTEND_URL must use HTTPS in production/staging');
  }

  if (!isProd && !data.SWAGGER_USER) {
    addCustomIssue(ctx, 'SWAGGER_USER', 'SWAGGER_USER is required in non-production environments');
  }

  if (!isProd && !data.SWAGGER_PASSWORD) {
    addCustomIssue(
      ctx,
      'SWAGGER_PASSWORD',
      'SWAGGER_PASSWORD is required in non-production environments',
    );
  }

  validateAllowedFrontendUrls(data, ctx, isProd);

  if (isDeployed && !data.COOKIE_DOMAIN) {
    addCustomIssue(
      ctx,
      'COOKIE_DOMAIN',
      'COOKIE_DOMAIN is required in production/staging (e.g. .ewumediastar.com)',
    );
  }

  if (isDeployed && !data.IMAP_RECORD_USER) {
    addCustomIssue(
      ctx,
      'IMAP_RECORD_USER',
      'IMAP_RECORD_USER is required in production/staging (drives outbound From and inbox listing)',
    );
  }

  validateOutboundFromAllowlist(data, ctx, isDeployed);
}

const ALLOWLIST_FIELD = 'AWS_SES_OUTBOUND_FROM_ALLOWLIST';

function validateOutboundFromAllowlist(
  data: ApiEnvData,
  ctx: RefinementCtx,
  isDeployed: boolean,
): void {
  const raw = data.AWS_SES_OUTBOUND_FROM_ALLOWLIST;
  if (!raw) {
    if (isDeployed) {
      addCustomIssue(
        ctx,
        ALLOWLIST_FIELD,
        `${ALLOWLIST_FIELD} is required in production/staging (comma-separated verified SES identities)`,
      );
    }
    return;
  }

  const entries = raw
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  const emailSchema = z.email();
  for (const entry of entries) {
    if (!emailSchema.safeParse(entry).success) {
      addCustomIssue(ctx, ALLOWLIST_FIELD, `Entry "${entry}" is not a valid email`);
      return;
    }
  }
}

export const envSchema = baseEnvSchema.superRefine(sharedRefinements);

export const apiEnvFullSchema = apiEnvSchema.superRefine((data, ctx) => {
  sharedRefinements(data, ctx);
  apiRefinements(data, ctx);
});

export type EnvVars = z.infer<typeof baseEnvSchema>;
export type ApiEnvVars = z.infer<typeof apiEnvSchema>;

function throwValidationError(issues: readonly { path: PropertyKey[]; message: string }[]): never {
  const formatted = issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Environment validation failed:\n${formatted}`);
}

export function validate(config: Record<string, unknown>): EnvVars {
  const result = envSchema.safeParse(config);
  if (!result.success) throwValidationError(result.error.issues);
  return result.data;
}

export function validateApi(config: Record<string, unknown>): ApiEnvVars {
  const result = apiEnvFullSchema.safeParse(config);
  if (!result.success) throwValidationError(result.error.issues);
  return result.data;
}
