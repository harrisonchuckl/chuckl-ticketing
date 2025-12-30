import { processScheduledCampaigns, processSendingCampaigns } from './campaigns.js';
import {
  processAbandonedCheckoutAutomations,
  processAutomationSteps,
  processNoPurchaseAutomations,
} from './automations.js';

let interval: NodeJS.Timeout | null = null;

export async function runMarketingWorkerOnce() {
  await processScheduledCampaigns();
  await processSendingCampaigns();
  await processNoPurchaseAutomations();
  await processAbandonedCheckoutAutomations();
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
