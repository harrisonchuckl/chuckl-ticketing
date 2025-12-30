import prisma from '../../lib/prisma.js';
import { MarketingConsentSource, MarketingConsentStatus, MarketingLawfulBasis } from '@prisma/client';

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
  }

  return contact;
}
