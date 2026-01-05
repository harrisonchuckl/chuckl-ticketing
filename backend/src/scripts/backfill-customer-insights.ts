import { runCustomerInsightsJob } from "../services/customer-insights.js";
import prisma from "../lib/prisma.js";

async function run() {
  const result = await runCustomerInsightsJob();
  console.log("Customer insights backfill complete", result);
}

run()
  .catch((err) => {
    console.error("Failed to backfill customer insights", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
