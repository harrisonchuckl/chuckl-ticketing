import prisma from '../../lib/prisma.js';
import { MarketingConsentSource, MarketingConsentStatus, MarketingLawfulBasis } from '@prisma/client';
import { recordConsentAudit } from './audit.js';
import { clearSuppression } from './campaigns.js';

export type ContactSyncInput = {
  tenantId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  town?: string | null;
  capturedIp?: string | null;
  capturedUserAgent?: string | null;
  marketingOptIn?: boolean | null;
  source?: MarketingConsentSource;
};

export type MembershipSyncInput = ContactSyncInput & {
  marketingOptIn: boolean | null;
};

export async function syncMarketingContactFromOrder(input: ContactSyncInput) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) return null;

  const contact = await prisma.marketingContact.upsert({
    where: { tenantId_email: { tenantId: input.tenantId, email } },
    create: {
      tenantId: input.tenantId,
      email,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      phone: input.phone || null,
      town: input.town || null,
    },
    update: {
      firstName: input.firstName || undefined,
      lastName: input.lastName || undefined,
      phone: input.phone || undefined,
      town: input.town || undefined,
    },
  });

  const existingConsent = await prisma.marketingConsent.findUnique({
    where: { tenantId_contactId: { tenantId: input.tenantId, contactId: contact.id } },
  });

  const optedIn = Boolean(input.marketingOptIn);

  if (!existingConsent) {
    const status = optedIn ? MarketingConsentStatus.SUBSCRIBED : MarketingConsentStatus.TRANSACTIONAL_ONLY;
    const lawfulBasis = optedIn ? MarketingLawfulBasis.EXPLICIT_OPT_IN : MarketingLawfulBasis.UNKNOWN;
    await prisma.marketingConsent.create({
      data: {
        tenantId: input.tenantId,
        contactId: contact.id,
        status,
        lawfulBasis,
        source: input.source || MarketingConsentSource.CHECKOUT,
        capturedAt: new Date(),
        capturedIp: input.capturedIp || null,
        capturedUserAgent: input.capturedUserAgent || null,
      },
    });
    await recordConsentAudit(input.tenantId, 'consent.created', contact.id, { status, source: input.source || MarketingConsentSource.CHECKOUT });
    return contact;
  }

  if (optedIn && existingConsent.status !== MarketingConsentStatus.SUBSCRIBED) {
    await prisma.marketingConsent.update({
      where: { tenantId_contactId: { tenantId: input.tenantId, contactId: contact.id } },
      data: {
        status: MarketingConsentStatus.SUBSCRIBED,
        lawfulBasis: MarketingLawfulBasis.EXPLICIT_OPT_IN,
        source: input.source || MarketingConsentSource.CHECKOUT,
        capturedAt: new Date(),
        capturedIp: input.capturedIp || null,
        capturedUserAgent: input.capturedUserAgent || null,
      },
    });
    await clearSuppression(input.tenantId, email);
    await recordConsentAudit(input.tenantId, 'consent.updated', contact.id, {
      status: MarketingConsentStatus.SUBSCRIBED,
      source: input.source || MarketingConsentSource.CHECKOUT,
    });
  }

  return contact;
}

export async function syncMarketingContactFromMembership(input: MembershipSyncInput) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) return null;

  const contact = await prisma.marketingContact.upsert({
    where: { tenantId_email: { tenantId: input.tenantId, email } },
    create: {
      tenantId: input.tenantId,
      email,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      phone: input.phone || null,
      town: input.town || null,
    },
    update: {
      firstName: input.firstName || undefined,
      lastName: input.lastName || undefined,
      phone: input.phone || undefined,
      town: input.town || undefined,
    },
  });

  const existingConsent = await prisma.marketingConsent.findUnique({
    where: { tenantId_contactId: { tenantId: input.tenantId, contactId: contact.id } },
  });

  const optedIn = Boolean(input.marketingOptIn);
  const targetStatus = optedIn ? MarketingConsentStatus.SUBSCRIBED : MarketingConsentStatus.TRANSACTIONAL_ONLY;
  const source = input.source || MarketingConsentSource.CHECKOUT;

  if (!existingConsent) {
    await prisma.marketingConsent.create({
      data: {
        tenantId: input.tenantId,
        contactId: contact.id,
        status: targetStatus,
        lawfulBasis: optedIn ? MarketingLawfulBasis.EXPLICIT_OPT_IN : MarketingLawfulBasis.UNKNOWN,
        source,
        capturedAt: new Date(),
        capturedIp: input.capturedIp || null,
        capturedUserAgent: input.capturedUserAgent || null,
      },
    });
    if (optedIn) await clearSuppression(input.tenantId, email);
    await recordConsentAudit(input.tenantId, 'consent.created', contact.id, { status: targetStatus, source });
    return contact;
  }

  const shouldUpdate =
    (optedIn && existingConsent.status !== MarketingConsentStatus.SUBSCRIBED) ||
    (!optedIn &&
      [MarketingConsentStatus.SUBSCRIBED, MarketingConsentStatus.TRANSACTIONAL_ONLY].includes(existingConsent.status));

  if (shouldUpdate) {
    await prisma.marketingConsent.update({
      where: { tenantId_contactId: { tenantId: input.tenantId, contactId: contact.id } },
      data: {
        status: targetStatus,
        lawfulBasis: optedIn ? MarketingLawfulBasis.EXPLICIT_OPT_IN : existingConsent.lawfulBasis,
        source,
        capturedAt: new Date(),
        capturedIp: input.capturedIp || null,
        capturedUserAgent: input.capturedUserAgent || null,
      },
    });
    if (optedIn) await clearSuppression(input.tenantId, email);
    await recordConsentAudit(input.tenantId, 'consent.updated', contact.id, { status: targetStatus, source });
  }

  return contact;
}
