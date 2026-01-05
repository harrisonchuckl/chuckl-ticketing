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
import prisma from '../../lib/prisma.js';

let interval: NodeJS.Timeout | null = null;

export async function runMarketingWorkerOnce() {
  await prisma.marketingWorkerState.upsert({
    where: { id: 'global' },
    update: { lastWorkerRunAt: new Date() },
    create: { id: 'global', lastWorkerRunAt: new Date(), lastSendAt: null },
  });
  await processScheduledCampaigns();
  await processSendingCampaigns();
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
