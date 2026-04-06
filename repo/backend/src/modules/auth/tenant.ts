import type { FastifyRequest } from 'fastify';

import { AuthError } from './auth.service';

export function getTenantId(request: FastifyRequest): string | undefined {
  return request.user?.tenantId;
}

export function requireTenantId(request: FastifyRequest): string {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    throw new AuthError('Tenant context is required', 403);
  }
  return tenantId;
}

export function tenantFilter(tenantId: string | undefined): { tenantId?: string } {
  return tenantId ? { tenantId } : {};
}
