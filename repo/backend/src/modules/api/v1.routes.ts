import type { FastifyPluginAsync } from 'fastify';

import { analyticsRoutes } from '../analytics/analytics.routes';
import { authRoutes } from '../auth/auth.routes';
import { billingRoutes } from '../billing/billing.routes';
import { bookingRoutes } from '../bookings/booking.routes';
import { notificationRoutes } from '../notifications/notification.routes';
import { webhookRoutes } from '../webhooks/webhook.routes';
import { workflowRoutes } from '../workflows/workflow.routes';

export const v1Routes: FastifyPluginAsync = async (app) => {
  app.register(authRoutes, { prefix: '/auth' });
  app.register(analyticsRoutes, { prefix: '/analytics' });
  app.register(billingRoutes, { prefix: '/billing' });
  app.register(bookingRoutes, { prefix: '/bookings' });
  app.register(notificationRoutes, { prefix: '/notifications' });
  app.register(webhookRoutes, { prefix: '/webhooks' });
  app.register(workflowRoutes, { prefix: '/workflows' });

  app.get('/health', {
    schema: {
      tags: ['system'],
      summary: 'Versioned API health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, async () => ({ status: 'ok', version: 'v1' }));
};
