import { runCustomerInsightsJob } from "./customer-insights.js";

let interval: NodeJS.Timeout | null = null;

export async function runCustomerInsightsWorkerOnce() {
  await runCustomerInsightsJob();
}

export function startCustomerInsightsWorker() {
  if (interval) return;
  const enabled = String(process.env.CUSTOMER_INSIGHTS_WORKER_ENABLED || "true") === "true";
  if (!enabled) return;

  const intervalMs = Number(process.env.CUSTOMER_INSIGHTS_WORKER_INTERVAL_MS || 24 * 60 * 60 * 1000);
  interval = setInterval(() => {
    runCustomerInsightsWorkerOnce().catch((error) => {
      console.error("Customer insights worker error", error);
    });
  }, intervalMs);
}

export function stopCustomerInsightsWorker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
