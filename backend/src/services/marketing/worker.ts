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
import { MarketingIntelligentCampaignKind } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { isWithinIntelligentSendWindow, runIntelligentCampaign } from './intelligent/runner.js';

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
