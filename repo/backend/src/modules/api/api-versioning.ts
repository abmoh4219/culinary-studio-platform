export const API_VERSION_PREFIX = {
  v1: '/api/v1'
} as const;

export type ApiVersion = keyof typeof API_VERSION_PREFIX;

export function resolveApiPrefix(version: ApiVersion): string {
  return API_VERSION_PREFIX[version];
}
