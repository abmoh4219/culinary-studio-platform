import { AuditAction } from '../../../prisma/generated';
import type { onResponseHookHandler } from 'fastify';

import { getRequestPath, isMutationRequest } from '../security/security.utils';

import { writeAuditLog } from './audit.service';

function auditActionForMethod(method: string): AuditAction {
  const upper = method.toUpperCase();
  if (upper === 'POST') {
    return AuditAction.CREATE;
  }

  if (upper === 'DELETE') {
    return AuditAction.DELETE;
  }

  return AuditAction.UPDATE;
}

function isHighRiskPath(path: string): boolean {
  return path.startsWith('/api/v1/bookings') || path.startsWith('/api/v1/billing');
}

export function createAuditOnResponseHook(): onResponseHookHandler {
  return async function auditOnResponse(request, reply): Promise<void> {
    if (!isMutationRequest(request)) {
      return;
    }

    const path = getRequestPath(request);
    if (!isHighRiskPath(path)) {
      return;
    }

    if (reply.statusCode >= 500) {
      return;
    }

    await writeAuditLog({
      actorUserId: request.user?.sub ?? null,
      action: auditActionForMethod(request.method),
      entityType: path.startsWith('/api/v1/bookings') ? 'booking_mutation' : 'billing_mutation',
      entityLabel: path,
      requestId: request.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
      afterJson: {
        method: request.method.toUpperCase(),
        path,
        statusCode: reply.statusCode,
        denied: reply.statusCode === 401 || reply.statusCode === 403
      }
    });
  };
}
