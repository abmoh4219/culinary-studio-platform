type FrontendConfig = {
  apiInternalBaseUrl: string;
  publicApiBaseUrl: string;
  securityActionPathPrefixes: string;
  signedRequestSecret: string;
  signedRequestKeyId: string;
};

let cachedConfig: FrontendConfig | null = null;

export function getFrontendConfig(): FrontendConfig {
  if (cachedConfig && process.env.NODE_ENV !== 'test') {
    return cachedConfig;
  }

  const resolved: FrontendConfig = {
    apiInternalBaseUrl: (process.env.API_INTERNAL_BASE_URL || 'https://backend:4000/api/v1').replace(/\/$/, ''),
    publicApiBaseUrl: (process.env.PUBLIC_API_BASE_URL || 'https://localhost:4000/api/v1').replace(/\/$/, ''),
    securityActionPathPrefixes: process.env.SECURITY_ACTION_PATH_PREFIXES || '/bookings,/billing,/invoices,/payments',
    signedRequestSecret: process.env.SIGNED_REQUEST_SECRET || '',
    signedRequestKeyId: process.env.SIGNED_REQUEST_KEY_ID || 'default'
  };

  if (process.env.NODE_ENV !== 'test') {
    cachedConfig = resolved;
  }

  return resolved;
}

export function resetFrontendConfig(): void {
  cachedConfig = null;
}
