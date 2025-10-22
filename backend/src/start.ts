// backend/src/start.ts
import 'dotenv/config';

// if you apply prisma push here, keep it; otherwise you can remove.
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const sh = promisify(exec);

async function main() {
  try {
    // Optional: only push on Railway to keep local dev faster
    if (process.env.RAILWAY_ENVIRONMENT) {
      const reset = process.env.RESET_DB === '1';
      const cmd = reset
        ? 'prisma db push --force-reset --accept-data-loss'
        : 'prisma db push';
      console.log('🔧 Applying Prisma schema (db push)');
      await sh(cmd, { env: process.env, cwd: process.cwd() });
    }
  } catch (e) {
    console.error('Prisma push failed:', e);
  }

  // Start the API
  await import('./server.js'); // ESM import of compiled server
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
