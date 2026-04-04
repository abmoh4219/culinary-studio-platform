import { buildApp } from './app';
import { getConfig } from './lib/config';

const config = getConfig();

const app = buildApp();
const port = config.BACKEND_PORT;
const host = config.BACKEND_HOST;

async function start() {
  try {
    app.log.info({ env: config.NODE_ENV }, 'Starting backend service');
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
