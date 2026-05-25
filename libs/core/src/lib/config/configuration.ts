import { registerAs } from '@nestjs/config';

import { THROTTLE_TIER_DEFAULTS } from '../constants/index';

const rateLimitTierConfig = (tier: string, defaults: { limit: number; ttl: number }) => ({
  limit: parseInt(
    process.env[`RATE_LIMIT_${tier.toUpperCase()}_LIMIT`] || String(defaults.limit),
    10,
  ),
  ttl: parseInt(process.env[`RATE_LIMIT_${tier.toUpperCase()}_TTL_MS`] || String(defaults.ttl), 10),
});

export const configuration = registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000', 10),
  appName: process.env['APP_NAME'] || 'ewu-media-backend',
  logLevel: process.env['LOG_LEVEL'] || 'log',

  database: {
    url: process.env['DATABASE_URL'] ?? '',
    pool: {
      max: parseInt(process.env['DATABASE_POOL_MAX'] || '10', 10),
      idleTimeoutMillis: parseInt(process.env['DATABASE_POOL_IDLE_TIMEOUT_MS'] || '10000', 10),
      connectionTimeoutMillis: parseInt(
        process.env['DATABASE_POOL_CONNECTION_TIMEOUT_MS'] || '5000',
        10,
      ),
    },
    transaction: {
      maxWait: parseInt(process.env['DATABASE_TX_MAX_WAIT_MS'] || '2000', 10),
      timeout: parseInt(process.env['DATABASE_TX_TIMEOUT_MS'] || '5000', 10),
    },
  },

  jwt: {
    secret: process.env['JWT_SECRET'] ?? undefined,
    refreshSecret: process.env['JWT_REFRESH_SECRET'] ?? undefined,
    twoFactorSecret: process.env['TWO_FACTOR_SECRET'] ?? undefined,
    sessionMgmtSecret: process.env['SESSION_MGMT_SECRET'] ?? undefined,
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '7d',
  },

  aws: {
    region: process.env['AWS_REGION'] || 'us-east-1',
    s3: {
      accessKeyId: process.env['AWS_S3_ACCESS_KEY_ID'] || '',
      secretAccessKey: process.env['AWS_S3_SECRET_ACCESS_KEY'] || '',
      bucket: process.env['AWS_S3_BUCKET'] || '',
      presignedExpiry: parseInt(process.env['AWS_S3_PRESIGNED_EXPIRY'] || '3600', 10),
      profileImagePresignedExpiry: parseInt(
        process.env['AWS_S3_PROFILE_IMAGE_PRESIGNED_EXPIRY'] || '604800',
        10,
      ),
    },
    ses: {
      accessKeyId: process.env['AWS_SES_ACCESS_KEY_ID'] || '',
      secretAccessKey: process.env['AWS_SES_SECRET_ACCESS_KEY'] || '',
      fromEmail: process.env['AWS_SES_FROM_EMAIL'] ?? '',
      outboundFromAllowlist: (process.env['AWS_SES_OUTBOUND_FROM_ALLOWLIST'] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      configurationSet: process.env['AWS_SES_CONFIGURATION_SET'] || undefined,
    },
    sqs: {
      accessKeyId: process.env['AWS_SQS_ACCESS_KEY_ID'] || '',
      secretAccessKey: process.env['AWS_SQS_SECRET_ACCESS_KEY'] || '',
      endpoint: process.env['AWS_SQS_ENDPOINT'] || '',
    },
  },

  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || '',
    tls: process.env['REDIS_TLS'] === 'true',
  },

  queue: {
    sqs: {
      emailClassifyUrl: process.env['SQS_EMAIL_CLASSIFY_URL'] || '',
    },
    bullmq: {
      defaultJobOptions: {
        attempts: parseInt(process.env['BULLMQ_DEFAULT_ATTEMPTS'] || '3', 10),
        backoffType: process.env['BULLMQ_BACKOFF_TYPE'] || 'exponential',
        backoffDelay: parseInt(process.env['BULLMQ_BACKOFF_DELAY_MS'] || '1000', 10),
        removeOnComplete: parseInt(process.env['BULLMQ_REMOVE_ON_COMPLETE'] || '100', 10),
        removeOnFail: parseInt(process.env['BULLMQ_REMOVE_ON_FAIL'] || '500', 10),
      },
    },
  },

  ai: {
    bedrock: {
      region: process.env['BEDROCK_REGION'] || process.env['AWS_REGION'] || 'us-east-1',
      modelId: process.env['BEDROCK_MODEL_ID'] || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      fallbackModelId:
        process.env['BEDROCK_FALLBACK_MODEL_ID'] || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      criticModelId:
        process.env['BEDROCK_CRITIC_MODEL_ID'] || 'anthropic.claude-haiku-4-5-20251001-v1:0',
      compressorModelId:
        process.env['BEDROCK_COMPRESSOR_MODEL_ID'] || 'anthropic.claude-haiku-4-5-20251001-v1:0',
      embeddingModelId: process.env['BEDROCK_EMBEDDING_MODEL_ID'] || 'cohere.embed-english-v4',
      accessKeyId: process.env['BEDROCK_ACCESS_KEY_ID'] || '',
      secretAccessKey: process.env['BEDROCK_SECRET_ACCESS_KEY'] || '',
      latencyOptimized: process.env['BEDROCK_LATENCY_OPTIMIZED'] === 'true',
    },
    firecrawl: {
      apiUrl: process.env['FIRECRAWL_API_URL'] || 'http://localhost:3002',
      apiKey: process.env['FIRECRAWL_API_KEY'] || '',
      timeoutMs: parseInt(process.env['FIRECRAWL_TIMEOUT_MS'] || '25000', 10),
      batchTimeoutMs: parseInt(process.env['FIRECRAWL_BATCH_TIMEOUT_MS'] || '60000', 10),
      retryMaxAttempts: parseInt(process.env['FIRECRAWL_RETRY_MAX_ATTEMPTS'] || '2', 10),
      retryBaseDelayMs: parseInt(process.env['FIRECRAWL_RETRY_BASE_DELAY_MS'] || '400', 10),
      scrapeMaxAgeMs: parseInt(process.env['FIRECRAWL_SCRAPE_MAX_AGE_MS'] || '86400000', 10),
    },
    caseAi: {
      prefetchUserUrls: process.env['CASE_AI_PREFETCH_USER_URLS'] !== 'false',
      prefetchMaxUrls: parseInt(process.env['CASE_AI_PREFETCH_MAX_URLS'] || '3', 10),
    },
    rateLimitRpm: parseInt(process.env['AI_RATE_LIMIT_RPM'] || '50', 10),
    rateLimitTpm: parseInt(process.env['AI_RATE_LIMIT_TPM'] || '0', 10),
    rateLimitWindowMs: parseInt(process.env['AI_RATE_LIMIT_WINDOW_MS'] || '60000', 10),
    sessionTtlDays: parseInt(process.env['AI_SESSION_TTL_DAYS'] || '30', 10),
    maxFilesPerMessage: parseInt(process.env['AI_MAX_FILES_PER_MESSAGE'] || '5', 10),
    maxUploadSizeMb: parseInt(process.env['AI_MAX_UPLOAD_SIZE_MB'] || '50', 10),
  },

  notification: {
    ttlDays: parseInt(process.env['NOTIFICATION_TTL_DAYS'] || '90', 10),
  },

  email: {
    trashTtlDays: parseInt(process.env['EMAIL_TRASH_TTL_DAYS'] || '30', 10),
    shareLink: {
      publicBaseUrl: process.env['APP_PUBLIC_BASE_URL'] || '',
      iconSourceUrl: process.env['EMAIL_SHARE_LINK_ICON_URL'] || '',
    },
  },

  imap: {
    host: process.env['IMAP_HOST'],
    port: parseInt(process.env['IMAP_PORT'] || '993', 10),
    tls: process.env['IMAP_TLS'] !== 'false',
    retryInitialDelayMs: parseInt(process.env['IMAP_RETRY_INITIAL_DELAY_MS'] || '1000', 10),
    retryMaxDelayMs: parseInt(process.env['IMAP_RETRY_MAX_DELAY_MS'] || '60000', 10),
    retryMultiplier: parseFloat(process.env['IMAP_RETRY_MULTIPLIER'] || '2'),
    retryJitterFactor: parseFloat(process.env['IMAP_RETRY_JITTER_FACTOR'] || '0.3'),
    retryMaxFailures: parseInt(process.env['IMAP_RETRY_MAX_FAILURES'] || '5', 10),
    noopIntervalMs: parseInt(process.env['IMAP_NOOP_INTERVAL_MS'] || '60000', 10),
    noopTimeoutMs: parseInt(process.env['IMAP_NOOP_TIMEOUT_MS'] || '10000', 10),
    lockTimeoutMs: parseInt(process.env['IMAP_LOCK_TIMEOUT_MS'] || '60000', 10),
    sentFolder: process.env['IMAP_SENT_FOLDER'] || 'Sent',
    oversizeThresholdBytes: parseInt(
      process.env['IMAP_OVERSIZE_THRESHOLD_BYTES'] || String(10 * 1024 * 1024),
      10,
    ),
    mailboxes: {
      record: {
        user: process.env['IMAP_RECORD_USER'],
        password: process.env['IMAP_RECORD_PASSWORD'],
      },
      foia: {
        user: process.env['IMAP_FOIA_USER'],
        password: process.env['IMAP_FOIA_PASSWORD'],
      },
    },
    parserPool: {
      enabled: process.env['PARSER_POOL_ENABLED'] !== 'false',
      minThreads: parseInt(process.env['PARSER_POOL_MIN_THREADS'] || '1', 10),
      maxThreads: parseInt(process.env['PARSER_POOL_MAX_THREADS'] || '0', 10),
      idleTimeoutMs: parseInt(process.env['PARSER_POOL_IDLE_TIMEOUT_MS'] || '30000', 10),
    },
  },

  emailSync: {
    intervalMs: parseInt(process.env['EMAIL_SYNC_INTERVAL_MS'] || '60000', 10),
    batchSize: parseInt(process.env['EMAIL_SYNC_BATCH_SIZE'] || '50', 10),
    healthPort: parseInt(process.env['EMAIL_SYNC_HEALTH_PORT'] || '3002', 10),
  },

  emailClassifier: {
    concurrency: parseInt(process.env['EMAIL_CLASSIFIER_CONCURRENCY'] || '5', 10),
    spamThreshold: parseFloat(process.env['CLASSIFIER_SPAM_THRESHOLD'] || '0.8'),
    modelVersion: process.env['CLASSIFIER_MODEL_VERSION'] || 'v1.0.0',
    healthPort: parseInt(process.env['CLASSIFIER_HEALTH_PORT'] || '3002', 10),
  },

  queueWorker: {
    healthPort: parseInt(process.env['QUEUE_WORKER_HEALTH_PORT'] || '3003', 10),
  },

  // Mailbox eligibility is gated by `aws.ses.outboundFromAllowlist`.
  emailSend: {
    maxAttempts: parseInt(process.env['EMAIL_SEND_MAX_ATTEMPTS'] || '3', 10),
    backoffType: process.env['EMAIL_SEND_BACKOFF_TYPE'] || 'exponential',
    backoffDelayMs: parseInt(process.env['EMAIL_SEND_BACKOFF_DELAY_MS'] || '30000', 10),
  },

  health: {
    heapThresholdBytes:
      parseInt(process.env['HEALTH_HEAP_THRESHOLD_MB'] || '512', 10) * 1024 * 1024,
    rssThresholdBytes: parseInt(process.env['HEALTH_RSS_THRESHOLD_MB'] || '1024', 10) * 1024 * 1024,
    diskThresholdPercent: parseFloat(process.env['HEALTH_DISK_THRESHOLD_PERCENT'] || '0.95'),
    dbTimeoutMs: parseInt(process.env['HEALTH_DB_TIMEOUT_MS'] || '1000', 10),
  },

  rateLimit: Object.fromEntries(
    Object.entries(THROTTLE_TIER_DEFAULTS).map(([tier, defaults]) => [
      tier,
      rateLimitTierConfig(tier, defaults),
    ]),
  ),
  totpEncryptionKey: process.env['TOTP_ENCRYPTION_KEY'] ?? '',

  twoFactor: {
    maxAttempts: parseInt(process.env['TWO_FACTOR_MAX_ATTEMPTS'] || '5', 10),
    lockoutMs: parseInt(process.env['TWO_FACTOR_LOCKOUT_MS'] || '900000', 10),
    tokenExpiry: process.env['TWO_FACTOR_TOKEN_EXPIRY'] || '5m',
    trustedDeviceTtlMs: parseInt(
      process.env['TWO_FACTOR_TRUSTED_DEVICE_TTL_MS'] || '2592000000',
      10,
    ),
    backupCodeCount: parseInt(process.env['TWO_FACTOR_BACKUP_CODE_COUNT'] || '10', 10),
    totpIssuer: process.env['TWO_FACTOR_TOTP_ISSUER'] || 'EWU Media',
    totpWindow: parseInt(process.env['TWO_FACTOR_TOTP_WINDOW'] || '1', 10),
  },

  corsOrigin: process.env['CORS_ORIGIN'],
  frontendUrl: process.env['FRONTEND_URL'],
  allowedFrontendUrls: (() => {
    const raw = process.env['ALLOWED_FRONTEND_URLS'] ?? '';
    const frontendUrl = process.env['FRONTEND_URL'] ?? '';
    const parsed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (frontendUrl && !parsed.includes(frontendUrl)) {
      parsed.unshift(frontendUrl);
    }
    return parsed.length > 0 ? parsed : [frontendUrl];
  })(),

  swagger: {
    user: process.env['SWAGGER_USER'],
    password: process.env['SWAGGER_PASSWORD'],
  },

  websocket: {
    port: parseInt(process.env['WS_PORT'] || '3001', 10),
  },

  cookie: {
    domain: process.env['COOKIE_DOMAIN'] || undefined,
  },

  recaptcha: {
    secretKey: process.env['RECAPTCHA_SECRET_KEY'] ?? '',
  },

  seedOwnerEmails: (process.env['SEED_OWNER_EMAILS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}));
