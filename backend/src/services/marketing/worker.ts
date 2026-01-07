import { processScheduledCampaigns, processSendingCampaigns } from './campaigns.js';
import {
  processAbandonedCheckoutAutomations,
  processAutomationSteps,
  processAnniversaryAutomations,
  processBirthdayAutomations,
  processLowSalesVelocityAutomations,
  processMonthlyRoundupAutomations,
  processNoPurchaseAutomations,
  processShowDateAutomations,
  processViewedNoPurchaseAutomations,
} from './automations.js';
import {
  MarketingCampaignStatus,
  MarketingCampaignType,
  MarketingConsentStatus,
  MarketingIntelligentCampaignKind,
  MarketingRecipientStatus,
  OrderStatus,
  ShowStatus,
  ProductOrderStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { isWithinIntelligentSendWindow, runIntelligentCampaign } from './intelligent/runner.js';
import { getRemainingTickets } from './intelligent/availability.js';
import { buildDefaultMergeContext, renderMergeTags } from '../../lib/email-marketing/merge-tags.js';
import { renderCompiledTemplate } from './template-compiler.js';
import { renderMarketingTemplate } from '../../lib/email-marketing/rendering.js';
import { createPreferencesToken } from '../../lib/email-marketing/preferences.js';
import { createUnsubscribeToken } from '../../lib/email-marketing/unsubscribe.js';
import { countIntelligentSendsLast30d, hasEmailedShowRecently } from './intelligent/eligibility.js';
import { buildContactPurchaseSignals } from './intelligent/recommendations.js';
import { hasPurchasedShow } from './intelligent/suppression.js';
import { shouldSuppressContact } from './campaigns.js';
import { buildRecommendedAddonsHtml } from './intelligent/blocks.js';

let interval: NodeJS.Timeout | null = null;

export async function runMarketingWorkerOnce() {
  await prisma.marketingWorkerState.upsert({
    where: { id: 'global' },
    update: { lastWorkerRunAt: new Date() },
    create: { id: 'global', lastWorkerRunAt: new Date(), lastSendAt: null },
  });
  await processScheduledCampaigns();
  await processSendingCampaigns();
  await processMonthlyDigestIntelligentCampaigns();
  await processAlmostSoldOutIntelligentCampaigns();
  await processAddonUpsellIntelligentCampaigns();
  await processNoPurchaseAutomations();
  await processAbandonedCheckoutAutomations();
  await processShowDateAutomations();
  await processMonthlyRoundupAutomations();
  await processLowSalesVelocityAutomations();
  await processViewedNoPurchaseAutomations();
  await processBirthdayAutomations();
  await processAnniversaryAutomations();
  await processAutomationSteps();
}

async function processMonthlyDigestIntelligentCampaigns() {
  const configs = await prisma.marketingIntelligentCampaign.findMany({
    where: {
      kind: MarketingIntelligentCampaignKind.MONTHLY_DIGEST,
      enabled: true,
    },
    select: {
      id: true,
      tenantId: true,
      lastRunAt: true,
      configJson: true,
    },
  });

  for (const config of configs) {
    const runAt = new Date();
    if (!shouldRunForMonth(config.lastRunAt, runAt)) continue;
    if (!isWithinIntelligentSendWindow(config.configJson, runAt)) continue;

    const result = await runIntelligentCampaign({
      tenantId: config.tenantId,
      kind: MarketingIntelligentCampaignKind.MONTHLY_DIGEST,
      dryRun: false,
      runAt,
    });

    if (!result.ok) {
      console.warn('[marketing:intelligent:monthly-digest] run failed', {
        tenantId: config.tenantId,
        message: result.message,
      });
      continue;
    }

    console.info('[marketing:intelligent:monthly-digest]', {
      runId: result.runId,
      tenantId: config.tenantId,
      campaignId: result.campaignId,
    });

    await prisma.marketingIntelligentCampaign.update({
      where: { id: config.id },
      data: { lastRunAt: runAt },
    });
  }
}

function shouldRunForMonth(lastRunAt: Date | null, now: Date) {
  if (!lastRunAt) return true;
  return lastRunAt.getFullYear() !== now.getFullYear() || lastRunAt.getMonth() !== now.getMonth();
}

function shouldRunForDay(lastRunAt: Date | null, now: Date) {
  if (!lastRunAt) return true;
  return (
    lastRunAt.getFullYear() !== now.getFullYear() ||
    lastRunAt.getMonth() !== now.getMonth() ||
    lastRunAt.getDate() !== now.getDate()
  );
}

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';

const DEFAULT_ALMOST_SOLD_OUT_THRESHOLD = 20;
const DEFAULT_ALMOST_SOLD_OUT_COOLDOWN_DAYS = 30;
const DEFAULT_ALMOST_SOLD_OUT_HORIZON_DAYS = 90;
const DEFAULT_ADDON_UPSELL_LOOKBACK_DAYS = 30;
const DEFAULT_ADDON_UPSELL_COOLDOWN_DAYS = 30;

async function processAlmostSoldOutIntelligentCampaigns() {
  const configs = await prisma.marketingIntelligentCampaign.findMany({
    where: {
      kind: MarketingIntelligentCampaignKind.ALMOST_SOLD_OUT,
      enabled: true,
    },
    include: { template: true },
  });

  for (const config of configs) {
    const runAt = new Date();
    if (!isWithinIntelligentSendWindow(config.configJson, runAt)) continue;
    if (!config.template) {
      console.warn('[marketing:intelligent:almost-sold-out] missing template', { tenantId: config.tenantId });
      continue;
    }

    const tenant = await prisma.user.findUnique({
      where: { id: config.tenantId },
      select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
    });
    if (!tenant) continue;

    const { threshold, cooldownDays, horizonDays } = resolveAlmostSoldOutConfig(config.configJson);
    const upcomingShows = await fetchUpcomingLiveShows(config.tenantId, horizonDays);
    if (!upcomingShows.length) continue;

    const contacts = await prisma.marketingContact.findMany({
      where: { tenantId: config.tenantId },
      include: { consents: { orderBy: { createdAt: 'desc' } } },
    });
    const suppressions = await prisma.marketingSuppression.findMany({
      where: { tenantId: config.tenantId },
      select: { email: true, type: true },
    });
    const suppressionMap = new Map(suppressions.map((suppression) => [normaliseEmail(suppression.email), suppression]));
    const contactSignals = new Map<string, Awaited<ReturnType<typeof buildContactPurchaseSignals>>>();

    for (const contact of contacts) {
      const email = normaliseEmail(contact.email || '');
      if (!email) continue;
      const signals = await buildContactPurchaseSignals(config.tenantId, email);
      contactSignals.set(email, signals);
    }

    const runDateLabel = runAt.toISOString().slice(0, 10);
    const updatedShowIds: string[] = [];
    const segment = await resolveIntelligentSegment(config.tenantId);

    for (const show of upcomingShows) {
      const remaining = await getRemainingTickets(show.id);
      if (remaining === null || remaining > threshold) continue;

      const campaignName = `IC: ALMOST_SOLD_OUT ${show.id} ${runDateLabel}`;
      const existing = await prisma.marketingCampaign.findFirst({
        where: { tenantId: config.tenantId, name: campaignName },
        select: { id: true },
      });
      if (existing) continue;

      const campaign = await prisma.marketingCampaign.create({
        data: {
          tenantId: config.tenantId,
          name: campaignName,
          templateId: config.templateId,
          segmentId: segment.id,
          type: MarketingCampaignType.ONE_OFF,
          status: MarketingCampaignStatus.SCHEDULED,
          scheduledFor: runAt,
          createdByUserId: config.tenantId,
          showId: show.id,
        },
      });

      const recipientsToCreate: Array<{
        tenantId: string;
        campaignId: string;
        contactId: string;
        email: string;
        status: MarketingRecipientStatus;
      }> = [];
      const snapshotsToCreate: Array<{
        tenantId: string;
        campaignId: string;
        templateId: string;
        recipientEmail: string;
        renderedHtml: string;
        renderedText: string | null;
        mergeContext: any;
      }> = [];

      const showUrl = resolveShowUrl(show, tenant);
      const showDateLabel = formatShowDate(show.date);

      for (const contact of contacts) {
        const email = normaliseEmail(contact.email || '');
        if (!email) continue;
        const reasons = new Set<string>();
        const suppression = suppressionMap.get(email) || null;
        const consentStatus =
          (contact.consents[0]?.status as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY;
        const suppressionDecision = shouldSuppressContact(consentStatus, suppression);
        if (suppressionDecision.suppressed && suppressionDecision.reason) {
          reasons.add(suppressionDecision.reason);
        }
        if (suppressionDecision.suppressed) continue;

        const signals = contactSignals.get(email);
        if (!signals || !isContactLikelyForShow(contact, signals, show)) continue;

        const purchased = await hasPurchasedShow(config.tenantId, email, show.id);
        if (purchased) continue;

        const sendCap = await countIntelligentSendsLast30d(config.tenantId, email);
        sendCap.reasons.forEach((reason) => reasons.add(reason));

        const recentEligibility = await hasEmailedShowRecently(config.tenantId, email, show.id, cooldownDays);
        recentEligibility.reasons.forEach((reason) => reasons.add(reason));
        if (!sendCap.eligible || !recentEligibility.eligible || reasons.size > 0) continue;

        const unsubscribeUrl = buildUnsubscribeUrl(tenant, email);
        const preferencesUrl = buildPreferencesUrl(tenant, email);

        const mergeContext = buildDefaultMergeContext({
          contact: {
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            email,
            town: contact.town || '',
          },
          show: {
            title: show.title || '',
            venue: show.venue?.name || '',
            date: showDateLabel,
            image: show.imageUrl || null,
          },
          links: {
            ticketLink: showUrl,
            managePreferencesLink: preferencesUrl,
            unsubscribeLink: unsubscribeUrl,
          },
        }) as Record<string, any>;

        mergeContext.showId = show.id;
        mergeContext.ticketsRemaining = remaining;
        mergeContext.show = {
          ...(mergeContext.show || {}),
          showId: show.id,
          ticketsRemaining: remaining,
        };

        let renderedHtml = '';
        if (config.template.compiledHtml) {
          renderedHtml = renderCompiledTemplate({
            compiledHtml: config.template.compiledHtml,
            mergeContext: mergeContext as any,
            unsubscribeUrl,
            preferencesUrl,
            showContext: {
              showTitle: show.title || '',
              showDate: showDateLabel,
              showVenue: show.venue?.name || '',
              showTown: show.venue?.city || '',
              showCounty: show.venue?.county || '',
              showUrl,
            },
          });
          if (config.template.compiledText) {
            renderMergeTags(config.template.compiledText, mergeContext as any);
          }
        } else {
          const rendered = renderMarketingTemplate(config.template.mjmlBody, {
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            email,
            tenantName: tenantNameFrom(tenant),
            unsubscribeUrl,
            preferencesUrl,
            showTitle: show.title || '',
            showDate: showDateLabel,
            showVenue: show.venue?.name || '',
            showTown: show.venue?.city || '',
            showCounty: show.venue?.county || '',
            showUrl,
            ticketsRemaining: remaining ?? '',
          });
          renderedHtml = rendered.html;
        }

        recipientsToCreate.push({
          tenantId: config.tenantId,
          campaignId: campaign.id,
          contactId: contact.id,
          email,
          status: MarketingRecipientStatus.PENDING,
        });
        snapshotsToCreate.push({
          tenantId: config.tenantId,
          campaignId: campaign.id,
          templateId: config.templateId,
          recipientEmail: email,
          renderedHtml,
          renderedText: null,
          mergeContext,
        });
      }

      if (recipientsToCreate.length) {
        await prisma.marketingCampaignRecipient.createMany({
          data: recipientsToCreate,
          skipDuplicates: true,
        });
      }
      if (snapshotsToCreate.length) {
        await prisma.marketingSendSnapshot.createMany({
          data: snapshotsToCreate,
          skipDuplicates: true,
        });
      }

      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { recipientsPreparedAt: runAt },
      });

      updatedShowIds.push(show.id);
    }

    if (updatedShowIds.length) {
      const nextConfig = updateAlmostSoldOutFiredConfig(config.configJson, updatedShowIds, runAt);
      await prisma.marketingIntelligentCampaign.update({
        where: { id: config.id },
        data: {
          lastRunAt: runAt,
          configJson: nextConfig,
        },
      });
    }
  }
}

async function processAddonUpsellIntelligentCampaigns() {
  const configs = await prisma.marketingIntelligentCampaign.findMany({
    where: {
      kind: MarketingIntelligentCampaignKind.ADDON_UPSELL,
      enabled: true,
    },
    include: { template: true },
  });

  for (const config of configs) {
    const runAt = new Date();
    if (!shouldRunForDay(config.lastRunAt, runAt)) continue;
    if (!isWithinIntelligentSendWindow(config.configJson, runAt)) continue;
    if (!config.template) {
      console.warn('[marketing:intelligent:addon-upsell] missing template', { tenantId: config.tenantId });
      continue;
    }

    const tenant = await prisma.user.findUnique({
      where: { id: config.tenantId },
      select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
    });
    if (!tenant) continue;

    const storefronts = await prisma.storefront.findMany({
      where: { ownerUserId: tenant.id },
      select: { id: true, slug: true },
    });
    const storefrontIds = storefronts.map((storefront) => storefront.id);
    const storefrontMap = new Map(storefronts.map((storefront) => [storefront.id, storefront.slug]));
    if (!storefrontIds.length) {
      await prisma.marketingIntelligentCampaign.update({
        where: { id: config.id },
        data: { lastRunAt: runAt },
      });
      continue;
    }

    const { lookbackDays, cooldownDays } = resolveAddonUpsellConfig(config.configJson);
    const lookbackMs = Math.max(0, Number(lookbackDays) || 0) * 24 * 60 * 60 * 1000;
    const lookbackDate = new Date(runAt.getTime() - lookbackMs);

    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        createdAt: { gte: lookbackDate },
        show: { organiserId: tenant.id },
      },
      select: {
        id: true,
        email: true,
        shippingEmail: true,
        showId: true,
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            slug: true,
            imageUrl: true,
            externalTicketUrl: true,
            usesExternalTicketing: true,
            venue: { select: { name: true, city: true, county: true } },
            organiser: { select: { storefrontSlug: true, id: true } },
          },
        },
      },
    });

    const ordersByShow = new Map<
      string,
      {
        show: NonNullable<typeof orders[number]['show']>;
        emails: Set<string>;
      }
    >();

    for (const order of orders) {
      const email = normaliseEmail(order.email || order.shippingEmail || '');
      if (!email || !order.show) continue;
      const entry = ordersByShow.get(order.showId) || { show: order.show, emails: new Set<string>() };
      entry.emails.add(email);
      ordersByShow.set(order.showId, entry);
    }

    const segment = await resolveIntelligentSegment(config.tenantId);
    const runDateLabel = runAt.toISOString().slice(0, 10);

    for (const [showId, entry] of ordersByShow.entries()) {
      const addOns = await prisma.storeShowAddOn.findMany({
        where: {
          organiserId: tenant.id,
          showId,
          isActive: true,
        },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              description: true,
              pricePence: true,
              currency: true,
              allowCustomAmount: true,
              slug: true,
              storefrontId: true,
              images: { select: { url: true, sortOrder: true } },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      if (!addOns.length) continue;

      const addonProducts = addOns.map((addon) => addon.product).filter(Boolean);
      const addonProductIds = addonProducts.map((product) => product.id);

      const recommendedAddonsPayload = addonProducts.map((product) => {
        const imageUrl = product.images.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url || null;
        const storefrontSlug = storefrontMap.get(product.storefrontId) || tenant.storefrontSlug || tenant.id;
        const productUrl = product.slug
          ? `${PUBLIC_BASE_URL.replace(/\\/+$/, '')}/store/${encodeURIComponent(storefrontSlug)}/products/${encodeURIComponent(
              product.slug
            )}`
          : null;
        const priceLabel = product.allowCustomAmount
          ? 'Pay what you want'
          : formatMoney(product.pricePence, product.currency);
        return {
          title: product.title || 'Recommended add-on',
          description: product.description || null,
          price: priceLabel || null,
          url: productUrl,
          imageUrl,
        };
      });

      const recommendedAddonsHtml = buildRecommendedAddonsHtml(recommendedAddonsPayload);
      const emails = Array.from(entry.emails.values());
      if (!emails.length || !recommendedAddonsHtml) continue;

      const emailFilters = emails.map((email) => ({ customerEmail: { equals: email, mode: 'insensitive' } }));
      const productOrders = emailFilters.length
        ? await prisma.productOrder.findMany({
            where: {
              status: ProductOrderStatus.PAID,
              storefrontId: { in: storefrontIds },
              OR: emailFilters,
            },
            select: {
              customerEmail: true,
              items: {
                where: { productId: { in: addonProductIds } },
                select: { productId: true },
              },
            },
          })
        : [];

      const purchasedEmails = new Set<string>();
      for (const productOrder of productOrders) {
        if (!productOrder.items.length) continue;
        const email = normaliseEmail(productOrder.customerEmail || '');
        if (!email) continue;
        purchasedEmails.add(email);
      }

      const eligibleEmails = emails.filter((email) => !purchasedEmails.has(normaliseEmail(email)));
      if (!eligibleEmails.length) continue;
      const eligibleEmailSet = new Set(eligibleEmails.map((email) => normaliseEmail(email)));

      const contactFilters = eligibleEmails.map((email) => ({ email: { equals: email, mode: 'insensitive' } }));
      const contacts = await prisma.marketingContact.findMany({
        where: {
          tenantId: config.tenantId,
          OR: contactFilters,
        },
        include: { consents: { orderBy: { createdAt: 'desc' } } },
      });

      if (!contacts.length) continue;

      const suppressions = await prisma.marketingSuppression.findMany({
        where: {
          tenantId: config.tenantId,
          OR: contactFilters,
        },
        select: { email: true, type: true },
      });
      const suppressionMap = new Map(suppressions.map((suppression) => [normaliseEmail(suppression.email), suppression]));

      const campaignName = `IC: ADDON_UPSELL ${showId} ${runDateLabel}`;
      const existing = await prisma.marketingCampaign.findFirst({
        where: { tenantId: config.tenantId, name: campaignName },
        select: { id: true },
      });
      if (existing) continue;

      let campaignId: string | null = null;
      const recipientsToCreate: Array<{
        tenantId: string;
        campaignId: string;
        contactId: string;
        email: string;
        status: MarketingRecipientStatus;
      }> = [];
      const snapshotsToCreate: Array<{
        tenantId: string;
        campaignId: string;
        templateId: string;
        recipientEmail: string;
        renderedHtml: string;
        renderedText: string | null;
        mergeContext: any;
      }> = [];

      const showDateLabel = formatShowDate(entry.show.date);
      const showUrl = resolveShowUrl(entry.show, tenant);

      for (const contact of contacts) {
        const email = normaliseEmail(contact.email || '');
        if (!email || !eligibleEmailSet.has(email)) continue;

        const reasons = new Set<string>();
        const suppression = suppressionMap.get(email) || null;
        const consentStatus =
          (contact.consents[0]?.status as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY;
        const suppressionDecision = shouldSuppressContact(consentStatus, suppression);
        if (suppressionDecision.suppressed && suppressionDecision.reason) {
          reasons.add(suppressionDecision.reason);
        }
        if (suppressionDecision.suppressed) continue;

        const sendCap = await countIntelligentSendsLast30d(config.tenantId, email);
        sendCap.reasons.forEach((reason) => reasons.add(reason));

        const recentEligibility = await hasEmailedShowRecently(config.tenantId, email, showId, cooldownDays);
        recentEligibility.reasons.forEach((reason) => reasons.add(reason));
        if (!sendCap.eligible || !recentEligibility.eligible || reasons.size > 0) continue;

        if (!campaignId) {
          const campaign = await prisma.marketingCampaign.create({
            data: {
              tenantId: config.tenantId,
              name: campaignName,
              templateId: config.templateId,
              segmentId: segment.id,
              type: MarketingCampaignType.ONE_OFF,
              status: MarketingCampaignStatus.SCHEDULED,
              scheduledFor: runAt,
              createdByUserId: config.tenantId,
              showId,
            },
          });
          campaignId = campaign.id;
        }

        const unsubscribeUrl = buildUnsubscribeUrl(tenant, email);
        const preferencesUrl = buildPreferencesUrl(tenant, email);

        const mergeContext = buildDefaultMergeContext({
          contact: {
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            email,
            town: contact.town || '',
          },
          show: {
            title: entry.show.title || '',
            venue: entry.show.venue?.name || '',
            date: showDateLabel,
            image: entry.show.imageUrl || null,
          },
          links: {
            ticketLink: showUrl,
            managePreferencesLink: preferencesUrl,
            unsubscribeLink: unsubscribeUrl,
          },
        }) as Record<string, any>;

        mergeContext.showId = showId;
        mergeContext.recommendedAddonsHtml = recommendedAddonsHtml;
        mergeContext.recommendedAddons = recommendedAddonsPayload;
        mergeContext.show = {
          ...(mergeContext.show || {}),
          showId,
        };

        let renderedHtml = '';
        if (config.template.compiledHtml) {
          renderedHtml = renderCompiledTemplate({
            compiledHtml: config.template.compiledHtml,
            mergeContext,
            unsubscribeUrl,
            preferencesUrl,
            recommendedAddonsHtml,
            showContext: {
              showTitle: entry.show.title || '',
              showDate: showDateLabel,
              showVenue: entry.show.venue?.name || '',
              showTown: entry.show.venue?.city || '',
              showCounty: entry.show.venue?.county || '',
              showUrl,
            },
          });
          if (config.template.compiledText) {
            renderMergeTags(config.template.compiledText, mergeContext);
          }
        } else {
          const rendered = renderMarketingTemplate(config.template.mjmlBody, {
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            email,
            tenantName: tenantNameFrom(tenant),
            unsubscribeUrl,
            preferencesUrl,
            recommendedAddonsHtml,
            showTitle: entry.show.title || '',
            showDate: showDateLabel,
            showVenue: entry.show.venue?.name || '',
            showTown: entry.show.venue?.city || '',
            showCounty: entry.show.venue?.county || '',
            showUrl,
          });
          renderedHtml = rendered.html;
        }

        recipientsToCreate.push({
          tenantId: config.tenantId,
          campaignId,
          contactId: contact.id,
          email,
          status: MarketingRecipientStatus.PENDING,
        });
        snapshotsToCreate.push({
          tenantId: config.tenantId,
          campaignId,
          templateId: config.templateId,
          recipientEmail: email,
          renderedHtml,
          renderedText: null,
          mergeContext,
        });
      }

      if (!campaignId) continue;

      if (recipientsToCreate.length) {
        await prisma.marketingCampaignRecipient.createMany({
          data: recipientsToCreate,
          skipDuplicates: true,
        });
      }
      if (snapshotsToCreate.length) {
        await prisma.marketingSendSnapshot.createMany({
          data: snapshotsToCreate,
          skipDuplicates: true,
        });
      }

      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: { recipientsPreparedAt: runAt },
      });
    }

    await prisma.marketingIntelligentCampaign.update({
      where: { id: config.id },
      data: { lastRunAt: runAt },
    });
  }
}

function resolveAlmostSoldOutConfig(configJson: unknown) {
  const base = {
    threshold: DEFAULT_ALMOST_SOLD_OUT_THRESHOLD,
    cooldownDays: DEFAULT_ALMOST_SOLD_OUT_COOLDOWN_DAYS,
    horizonDays: DEFAULT_ALMOST_SOLD_OUT_HORIZON_DAYS,
  };
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
    return base;
  }
  const config = configJson as Record<string, any>;
  const thresholdRaw =
    config.threshold ?? config.remainingThreshold ?? config.ticketsRemainingThreshold ?? config.almostSoldOutThreshold;
  const cooldownRaw = config.showCooldownDays ?? config.cooldownDays ?? config.almostSoldOutCooldownDays;
  const horizonRaw = config.horizonDays ?? config.lookaheadDays ?? config.recommendationHorizonDays;
  const threshold = Number.isFinite(Number(thresholdRaw)) ? Math.max(0, Number(thresholdRaw)) : base.threshold;
  const cooldownDays = Number.isFinite(Number(cooldownRaw)) ? Math.max(0, Number(cooldownRaw)) : base.cooldownDays;
  const horizonDays = Number.isFinite(Number(horizonRaw)) ? Math.max(1, Number(horizonRaw)) : base.horizonDays;
  return { threshold, cooldownDays, horizonDays };
}

function resolveAddonUpsellConfig(configJson: unknown) {
  const base = {
    lookbackDays: DEFAULT_ADDON_UPSELL_LOOKBACK_DAYS,
    cooldownDays: DEFAULT_ADDON_UPSELL_COOLDOWN_DAYS,
  };
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
    return base;
  }
  const config = configJson as Record<string, any>;
  const lookbackRaw = config.purchaseLookbackDays ?? config.lookbackDays ?? config.daysLookback;
  const cooldownRaw = config.showCooldownDays ?? config.cooldownDays ?? config.upsellCooldownDays;
  const lookbackDays = Number.isFinite(Number(lookbackRaw)) ? Math.max(1, Number(lookbackRaw)) : base.lookbackDays;
  const cooldownDays = Number.isFinite(Number(cooldownRaw)) ? Math.max(0, Number(cooldownRaw)) : base.cooldownDays;
  return { lookbackDays, cooldownDays };
}

function updateAlmostSoldOutFiredConfig(configJson: unknown, showIds: string[], runAt: Date) {
  const base =
    configJson && typeof configJson === 'object' && !Array.isArray(configJson) ? { ...(configJson as Record<string, any>) } : {};
  const existingMap =
    base.lastFiredByShowId && typeof base.lastFiredByShowId === 'object' && !Array.isArray(base.lastFiredByShowId)
      ? { ...(base.lastFiredByShowId as Record<string, string>) }
      : {};
  const runLabel = runAt.toISOString();
  for (const showId of showIds) {
    if (!showId) continue;
    existingMap[showId] = runLabel;
  }
  return { ...base, lastFiredByShowId: existingMap };
}

function normaliseEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeMatch(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function formatMoney(pence: number | null | undefined, currency?: string | null) {
  if (!Number.isFinite(Number(pence))) return '';
  const value = Number(pence) / 100;
  const safeCurrency = String(currency || 'gbp').toUpperCase();
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: safeCurrency }).format(value);
  } catch (error) {
    return `${safeCurrency} ${value.toFixed(2)}`;
  }
}

function isContactLikelyForShow(
  contact: { town?: string | null },
  signals: Awaited<ReturnType<typeof buildContactPurchaseSignals>>,
  show: {
    eventCategory: string | null;
    venue: { city: string | null; county: string | null } | null;
  }
) {
  const showCategory = normalizeMatch(show.eventCategory);
  const showCity = normalizeMatch(show.venue?.city);
  const showCounty = normalizeMatch(show.venue?.county);
  const contactTown = normalizeMatch(contact.town);

  const categoryMatch =
    showCategory &&
    Object.keys(signals.categories || {}).some((category) => normalizeMatch(category) === showCategory);
  const cityMatch =
    showCity &&
    (contactTown === showCity ||
      Object.keys(signals.venueCities || {}).some((city) => normalizeMatch(city) === showCity));
  const countyMatch =
    showCounty &&
    Object.keys(signals.venueCounties || {}).some((county) => normalizeMatch(county) === showCounty);

  return Boolean(categoryMatch || cityMatch || countyMatch);
}

async function fetchUpcomingLiveShows(tenantId: string, horizonDays: number) {
  const now = new Date();
  const horizonMs = Math.max(0, Number(horizonDays) || 0) * 24 * 60 * 60 * 1000;
  const horizonDate = new Date(now.getTime() + horizonMs);
  return prisma.show.findMany({
    where: {
      organiserId: tenantId,
      status: ShowStatus.LIVE,
      date: { gte: now, lte: horizonDate },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      title: true,
      date: true,
      slug: true,
      eventCategory: true,
      imageUrl: true,
      externalTicketUrl: true,
      usesExternalTicketing: true,
      venue: { select: { name: true, city: true, county: true } },
      organiser: { select: { storefrontSlug: true, id: true } },
    },
  });
}

function resolveShowUrl(
  show: {
    id: string;
    usesExternalTicketing?: boolean | null;
    externalTicketUrl?: string | null;
    slug?: string | null;
    organiser?: { storefrontSlug?: string | null; id: string } | null;
  },
  tenant: { storefrontSlug?: string | null; id: string }
) {
  if (show.usesExternalTicketing && show.externalTicketUrl) {
    return show.externalTicketUrl;
  }
  const slug = show.slug && show.organiser
    ? `/public/${encodeURIComponent(show.organiser.storefrontSlug || show.organiser.id)}/${encodeURIComponent(show.slug)}`
    : null;
  return `${PUBLIC_BASE_URL.replace(/\\/+$/, '')}${slug || `/public/event/${encodeURIComponent(show.id)}`}`;
}

function formatShowDate(date?: Date | string | null) {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}

function buildUnsubscribeUrl(tenant: { storefrontSlug?: string | null; id: string }, email: string) {
  const token = createUnsubscribeToken({ tenantId: tenant.id, email });
  return `${PUBLIC_BASE_URL.replace(/\\/+$/, '')}/u/${encodeURIComponent(tenant.storefrontSlug || tenant.id)}/${encodeURIComponent(
    token
  )}`;
}

function buildPreferencesUrl(tenant: { storefrontSlug?: string | null; id: string }, email: string) {
  const token = createPreferencesToken({ tenantId: tenant.id, email });
  return `${PUBLIC_BASE_URL.replace(/\\/+$/, '')}/preferences/${encodeURIComponent(tenant.storefrontSlug || tenant.id)}/${encodeURIComponent(
    token
  )}`;
}

async function resolveIntelligentSegment(tenantId: string) {
  const existingAllContacts = await prisma.marketingSegment.findFirst({
    where: {
      tenantId,
      name: { equals: 'All contacts', mode: 'insensitive' },
    },
  });
  if (existingAllContacts) return existingAllContacts;

  const systemSegment = await prisma.marketingSegment.findFirst({
    where: { tenantId, name: 'System: Intelligent Campaigns' },
  });
  if (systemSegment) return systemSegment;

  return prisma.marketingSegment.create({
    data: {
      tenantId,
      name: 'System: Intelligent Campaigns',
      description: 'System segment for intelligent campaign runs.',
      rules: { rules: [] },
    },
  });
}

export function startMarketingWorker() {
  if (interval) return;
  const enabled = String(process.env.MARKETING_WORKER_ENABLED || 'true') === 'true';
  if (!enabled) return;

  const intervalMs = Number(process.env.MARKETING_WORKER_INTERVAL_MS || 30000);
  interval = setInterval(() => {
    runMarketingWorkerOnce().catch((error) => {
      console.error('Marketing worker error', error);
    });
  }, intervalMs);
}

export function stopMarketingWorker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
