import prisma from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export async function recordConsentAudit(
  tenantId: string,
  action: string,
  contactId: string,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
      action,
      entityType: 'MarketingConsent',
      entityId: contactId,
      metadata: metadata || undefined,
    },
  });
}

export async function recordSuppressionAudit(
  tenantId: string,
  action: string,
  suppressionId: string | null,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
      action,
      entityType: 'MarketingSuppression',
      entityId: suppressionId || undefined,
      metadata: metadata || undefined,
    },
  });
}
