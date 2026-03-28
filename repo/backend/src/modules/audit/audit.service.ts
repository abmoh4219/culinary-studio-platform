import { AuditAction, Prisma } from '../../../prisma/generated';
import { encryptOptionalField } from '../../lib/crypto';
import { prisma } from '../../lib/prisma';
import { sha256Hex } from '../security/security.utils';

type AuditInput = {
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  beforeJson?: Prisma.InputJsonValue | null;
  afterJson?: Prisma.InputJsonValue | null;
  sensitiveText?: string | null;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  if (process.env.NODE_ENV === 'test' && process.env.RUN_REAL_INTEGRATION !== 'true') {
    return;
  }

  const auditModel = (prisma as unknown as { auditLog?: { create: (args: unknown) => Promise<unknown> } }).auditLog;
  if (!auditModel) {
    return;
  }

  try {
    const userAgent = encryptOptionalField(input.userAgent ?? null);
    const sensitive = encryptOptionalField(input.sensitiveText ?? null);

    await auditModel.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        requestId: input.requestId ?? null,
        ipHash: input.ip ? sha256Hex(input.ip) : null,
        userAgentCiphertext: userAgent.ciphertext,
        userAgentIv: userAgent.iv,
        beforeJson: input.beforeJson ?? undefined,
        afterJson: input.afterJson ?? undefined,
        sensitiveCiphertext: sensitive.ciphertext,
        sensitiveIv: sensitive.iv
      }
    });
  } catch {
    // Audit logging should never block primary business flow.
  }
}
