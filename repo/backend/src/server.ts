import dotenv from 'dotenv';

import { buildApp } from './app';
import { getEnv } from './config/env';

dotenv.config();

const env = getEnv();

const app = buildApp();
const port = Number(process.env.BACKEND_PORT || 4000);
const host = process.env.BACKEND_HOST || '0.0.0.0';

async function start() {
  try {
    app.log.info({ env: env.NODE_ENV }, 'Starting backend service');
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
