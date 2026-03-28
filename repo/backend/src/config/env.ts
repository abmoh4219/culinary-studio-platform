type NodeEnv = 'development' | 'test' | 'production';

export type AppEnv = {
  NODE_ENV: NodeEnv;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  REDIS_URL?: string;
};

const DEV_JWT_ACCESS_SECRET = 'development_access_secret';
const DEV_JWT_REFRESH_SECRET = 'development_refresh_secret';

let cachedEnv: AppEnv | null = null;

function requiredString(name: string, value: string | undefined, errors: string[]): string {
  if (!value || value.trim().length === 0) {
    errors.push(`${name} is required`);
    return '';
  }

  return value;
}

function parseNodeEnv(raw: string | undefined, errors: string[]): NodeEnv {
  const value = raw?.trim();
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }

  errors.push('NODE_ENV must be one of: development, test, production');
  return 'development';
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const errors: string[] = [];
  const NODE_ENV = parseNodeEnv(process.env.NODE_ENV, errors);
  const DATABASE_URL = requiredString('DATABASE_URL', process.env.DATABASE_URL, errors);

  const rawAccess = process.env.JWT_ACCESS_SECRET;
  const rawRefresh = process.env.JWT_REFRESH_SECRET;

  const JWT_ACCESS_SECRET =
    rawAccess && rawAccess.trim().length > 0
      ? rawAccess
      : NODE_ENV === 'development'
        ? DEV_JWT_ACCESS_SECRET
        : requiredString('JWT_ACCESS_SECRET', rawAccess, errors);

  const JWT_REFRESH_SECRET =
    rawRefresh && rawRefresh.trim().length > 0
      ? rawRefresh
      : NODE_ENV === 'development'
        ? DEV_JWT_REFRESH_SECRET
        : requiredString('JWT_REFRESH_SECRET', rawRefresh, errors);

  if (errors.length > 0) {
    throw new Error(`Invalid runtime environment:\n- ${errors.join('\n- ')}`);
  }

  cachedEnv = {
    NODE_ENV,
    DATABASE_URL,
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    REDIS_URL: process.env.REDIS_URL
  };

  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
