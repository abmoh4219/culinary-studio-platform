import { getConfig, resetConfigCache } from '../lib/config';

export function getEnv() {
  return getConfig();
}

export function resetEnvCache(): void {
  resetConfigCache();
}
