import type { FastifyPluginAsync } from 'fastify';

import { Prisma, WebhookDeliveryStatus, WebhookFailureAlertStatus, WebhookStatus } from '../../../prisma/generated';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { AuthError } from '../auth/auth.service';

import {
  acknowledgeWebhookFailureAlert,
  createWebhookConfig,
  dispatchDueWebhookLogs,
  listWebhookConfigs,
  publishWebhookEvent,
  queryWebhookFailureAlerts,
  queryWebhookLogs,
  updateWebhookConfig
} from './webhook.service';

type ConfigBody = {
  name: string;
  eventKey: string;
  endpoint: string;
  signingSecret: string;
  status?: WebhookStatus;
  timeoutSeconds?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
};

type ConfigUpdateBody = Partial<ConfigBody>;

type DispatchBody = {
  limit?: number;
};

type EmitBody = {
  eventKey: string;
  payload: Prisma.InputJsonValue;
};

type LogQuery = {
  eventKey?: string;
  deliveryStatus?: string;
  webhookConfigId?: string;
  from?: string;
  to?: string;
  limit?: string;
};

type FailureAlertQuery = {
  status?: string;
  webhookConfigId?: string;
  eventKey?: string;
  from?: string;
  to?: string;
  limit?: string;
};

const configBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'eventKey', 'endpoint', 'signingSecret'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    eventKey: { type: 'string', minLength: 1, maxLength: 80 },
    endpoint: { type: 'string', minLength: 1, maxLength: 2048 },
    signingSecret: { type: 'string', minLength: 1, maxLength: 255 },
    status: { type: 'string', enum: Object.values(WebhookStatus) },
    timeoutSeconds: { type: 'integer', minimum: 1, maximum: 120 },
    maxRetries: { type: 'integer', minimum: 1, maximum: 20 },
    headers: {
      type: 'object',
      additionalProperties: { type: 'string', maxLength: 400 }
    }
  }
} as const;

const configUpdateBodySchema = {
  ...configBodySchema,
  required: []
} as const;

const pagedQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eventKey: { type: 'string', minLength: 1, maxLength: 80 },
    deliveryStatus: { type: 'string', enum: Object.values(WebhookDeliveryStatus) },
    status: { type: 'string', enum: Object.values(WebhookFailureAlertStatus) },
    webhookConfigId: { type: 'string', minLength: 1, maxLength: 64 },
    from: { type: 'string', format: 'date-time' },
    to: { type: 'string', format: 'date-time' },
    limit: { type: 'string', pattern: '^[1-9]\\d{0,2}$' }
  }
} as const;

const configIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['configId'],
  properties: {
    configId: { type: 'string', minLength: 1, maxLength: 64 }
  }
} as const;

const emitBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventKey', 'payload'],
  properties: {
    eventKey: { type: 'string', minLength: 1, maxLength: 80 },
    payload: {
      anyOf: [
        { type: 'object' },
        { type: 'array' },
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' }
      ]
    }
  }
} as const;

function parseLimit(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new AuthError('limit must be a positive integer', 400);
  }

  return value;
}

function parseDeliveryStatus(raw: string | undefined): WebhookDeliveryStatus | undefined {
  if (!raw) {
    return undefined;
  }

  if (!Object.values(WebhookDeliveryStatus).includes(raw as WebhookDeliveryStatus)) {
    throw new AuthError(`Invalid deliveryStatus: ${raw}`, 400);
  }

  return raw as WebhookDeliveryStatus;
}

function parseFailureAlertStatus(raw: string | undefined): WebhookFailureAlertStatus | undefined {
  if (!raw) {
    return undefined;
  }

  if (!Object.values(WebhookFailureAlertStatus).includes(raw as WebhookFailureAlertStatus)) {
    throw new AuthError(`Invalid alert status: ${raw}`, 400);
  }

  return raw as WebhookFailureAlertStatus;
}

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/configs',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const configs = await listWebhookConfigs(request.user.roles ?? []);
        return reply.send({ configs });
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: ConfigBody }>(
    '/configs',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])],
      schema: {
        body: configBodySchema
      }
    },
    async (request, reply) => {
      try {
        const created = await createWebhookConfig({
          actorRoles: request.user.roles ?? [],
          ...request.body
        });

        return reply.code(201).send(created);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.put<{ Params: { configId: string }; Body: ConfigUpdateBody }>(
    '/configs/:configId',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])],
      schema: {
        params: configIdParamsSchema,
        body: configUpdateBodySchema
      }
    },
    async (request, reply) => {
      try {
        const updated = await updateWebhookConfig({
          actorRoles: request.user.roles ?? [],
          configId: request.params.configId,
          ...request.body
        });

        return reply.send(updated);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: EmitBody }>(
    '/emit',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])],
      schema: {
        body: emitBodySchema
      }
    },
    async (request, reply) => {
      try {
        const result = await publishWebhookEvent({
          eventKey: request.body.eventKey,
          payload: request.body.payload
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: DispatchBody }>(
    '/dispatch-due',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const result = await dispatchDueWebhookLogs({
          actorRoles: request.user.roles ?? [],
          limit: request.body.limit
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Querystring: LogQuery }>(
    '/logs',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const result = await queryWebhookLogs({
          actorRoles: request.user.roles ?? [],
          eventKey: request.query.eventKey,
          deliveryStatus: parseDeliveryStatus(request.query.deliveryStatus),
          webhookConfigId: request.query.webhookConfigId,
          from: request.query.from,
          to: request.query.to,
          limit: parseLimit(request.query.limit)
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Querystring: FailureAlertQuery }>(
    '/failure-alerts',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const result = await queryWebhookFailureAlerts({
          actorRoles: request.user.roles ?? [],
          status: parseFailureAlertStatus(request.query.status),
          webhookConfigId: request.query.webhookConfigId,
          eventKey: request.query.eventKey,
          from: request.query.from,
          to: request.query.to,
          limit: parseLimit(request.query.limit)
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Params: { alertId: string } }>(
    '/failure-alerts/:alertId/ack',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const result = await acknowledgeWebhookFailureAlert({
          actorUserId: request.user.sub,
          actorRoles: request.user.roles ?? [],
          alertId: request.params.alertId
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );
};
