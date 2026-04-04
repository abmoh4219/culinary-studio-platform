type NodeEnv = 'development' | 'test' | 'production';

export type AppConfig = {
  NODE_ENV: NodeEnv;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  REDIS_URL?: string;
  BACKEND_PORT: number;
  BACKEND_HOST: string;
  LOG_LEVEL: string;
  CORS_ORIGINS: string[];
  TRUST_PROXY: boolean | number;
  AUTH_COOKIE_SECURE: boolean;
  AUTH_COOKIE_SAME_SITE: 'strict';
  SECURITY_ACTION_PATH_PREFIXES: string;
  SIGNED_REQUEST_SECRET: string;
  SIGNED_REQUEST_KEY_ID: string;
  SIGNED_REQUEST_MAX_SKEW_SECONDS: number;
  SIGNED_REQUEST_NONCE_TTL_SECONDS: number;
  IDEMPOTENCY_KEY_TTL_HOURS: number;
  IDEMPOTENCY_IN_PROGRESS_TIMEOUT_SECONDS: number;
  RATE_LIMIT_MAX_REQUESTS_PER_MINUTE: number;
  BOOKING_OPEN_HOURS_NON_MEMBER: number;
  BOOKING_MEMBER_EARLY_ACCESS_HOURS: number;
  AUTH_LOCK_MAX_ATTEMPTS: number;
  AUTH_LOCK_DURATION_MINUTES: number;
  SALES_TAX_RATE: number;
  INVOICE_DUE_DAYS: number;
  WEBHOOK_ALLOW_LOCAL_TARGETS: boolean;
  WEBHOOK_RETRY_BASE_SECONDS: number;
  WEBHOOK_RETRY_MAX_SECONDS: number;
  WEBHOOK_FAILURE_ALERT_THRESHOLD_ATTEMPTS: number;
  FIELD_ENCRYPTION_KEY?: string;
  FIELD_ENCRYPTION_ALLOW_PLAINTEXT_FALLBACK: boolean;
  RUN_REAL_INTEGRATION: boolean;
};

const DEV_JWT_ACCESS_SECRET = 'development_access_secret';
const DEV_JWT_REFRESH_SECRET = 'development_refresh_secret';

let cachedConfig: AppConfig | null = null;

function parseNodeEnv(raw: string | undefined): NodeEnv {
  if (raw === 'development' || raw === 'test' || raw === 'production') {
    return raw;
  }

  return 'development';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseNonNegativeNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function parseTrustProxy(value: string | undefined): boolean | number {
  if (!value) {
    return true;
  }

  if (value === 'true') {
    return true;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed);
  }

  return true;
}

function parseCorsOrigins(raw: string | undefined): string[] {
  const value = raw?.trim();
  if (!value) {
    return ['https://localhost:5173'];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getConfig(): AppConfig {
  if (cachedConfig && parseNodeEnv(process.env.NODE_ENV) !== 'test') {
    return cachedConfig;
  }

  const errors: string[] = [];
  const NODE_ENV = parseNodeEnv(process.env.NODE_ENV);
  const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';
  const rawAccess = process.env.JWT_ACCESS_SECRET?.trim();
  const rawRefresh = process.env.JWT_REFRESH_SECRET?.trim();
  const JWT_ACCESS_SECRET = rawAccess || (NODE_ENV === 'development' ? DEV_JWT_ACCESS_SECRET : '');
  const JWT_REFRESH_SECRET = rawRefresh || (NODE_ENV === 'development' ? DEV_JWT_REFRESH_SECRET : '');

  if (!DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!JWT_ACCESS_SECRET) {
    errors.push('JWT_ACCESS_SECRET is required');
  }

  if (!JWT_REFRESH_SECRET) {
    errors.push('JWT_REFRESH_SECRET is required');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid runtime environment:\n- ${errors.join('\n- ')}`);
  }

  const resolved: AppConfig = {
    NODE_ENV,
    DATABASE_URL,
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN?.trim() || '15m',
    REDIS_URL: process.env.REDIS_URL?.trim() || undefined,
    BACKEND_PORT: parsePositiveInt(process.env.BACKEND_PORT, 4000),
    BACKEND_HOST: process.env.BACKEND_HOST?.trim() || '0.0.0.0',
    LOG_LEVEL: process.env.LOG_LEVEL?.trim() || 'info',
    CORS_ORIGINS: parseCorsOrigins(process.env.CORS_ORIGIN),
    TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
    AUTH_COOKIE_SECURE: parseBoolean(process.env.AUTH_COOKIE_SECURE, true),
    AUTH_COOKIE_SAME_SITE: 'strict',
    SECURITY_ACTION_PATH_PREFIXES: process.env.SECURITY_ACTION_PATH_PREFIXES || '/bookings,/billing,/invoices,/payments',
    SIGNED_REQUEST_SECRET: process.env.SIGNED_REQUEST_SECRET || '',
    SIGNED_REQUEST_KEY_ID: process.env.SIGNED_REQUEST_KEY_ID || 'default',
    SIGNED_REQUEST_MAX_SKEW_SECONDS: parsePositiveInt(process.env.SIGNED_REQUEST_MAX_SKEW_SECONDS, 300),
    SIGNED_REQUEST_NONCE_TTL_SECONDS: parsePositiveInt(process.env.SIGNED_REQUEST_NONCE_TTL_SECONDS, 600),
    IDEMPOTENCY_KEY_TTL_HOURS: parsePositiveInt(process.env.IDEMPOTENCY_KEY_TTL_HOURS, 24),
    IDEMPOTENCY_IN_PROGRESS_TIMEOUT_SECONDS: parsePositiveInt(process.env.IDEMPOTENCY_IN_PROGRESS_TIMEOUT_SECONDS, 30),
    RATE_LIMIT_MAX_REQUESTS_PER_MINUTE: parsePositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS_PER_MINUTE, 60),
    BOOKING_OPEN_HOURS_NON_MEMBER: parsePositiveInt(process.env.BOOKING_OPEN_HOURS_NON_MEMBER, 72),
    BOOKING_MEMBER_EARLY_ACCESS_HOURS: parsePositiveInt(process.env.BOOKING_MEMBER_EARLY_ACCESS_HOURS, 24),
    AUTH_LOCK_MAX_ATTEMPTS: parsePositiveInt(process.env.AUTH_LOCK_MAX_ATTEMPTS, 10),
    AUTH_LOCK_DURATION_MINUTES: parsePositiveInt(process.env.AUTH_LOCK_DURATION_MINUTES, 15),
    SALES_TAX_RATE: parseNonNegativeNumber(process.env.SALES_TAX_RATE, 0.08875),
    INVOICE_DUE_DAYS: parsePositiveInt(process.env.INVOICE_DUE_DAYS, 14),
    WEBHOOK_ALLOW_LOCAL_TARGETS: parseBoolean(process.env.WEBHOOK_ALLOW_LOCAL_TARGETS, NODE_ENV !== 'production'),
    WEBHOOK_RETRY_BASE_SECONDS: parsePositiveInt(process.env.WEBHOOK_RETRY_BASE_SECONDS, 5),
    WEBHOOK_RETRY_MAX_SECONDS: parsePositiveInt(process.env.WEBHOOK_RETRY_MAX_SECONDS, 300),
    WEBHOOK_FAILURE_ALERT_THRESHOLD_ATTEMPTS: parsePositiveInt(process.env.WEBHOOK_FAILURE_ALERT_THRESHOLD_ATTEMPTS, 3),
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
    FIELD_ENCRYPTION_ALLOW_PLAINTEXT_FALLBACK: parseBoolean(process.env.FIELD_ENCRYPTION_ALLOW_PLAINTEXT_FALLBACK, false),
    RUN_REAL_INTEGRATION: parseBoolean(process.env.RUN_REAL_INTEGRATION, false)
  };

  if (NODE_ENV !== 'test') {
    cachedConfig = resolved;
  }

  return resolved;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
