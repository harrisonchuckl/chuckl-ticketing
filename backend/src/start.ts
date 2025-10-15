import { execSync } from 'node:child_process';
import 'dotenv/config';

// One-time forced reset when RESET_DB=1
try {
  if (process.env.RESET_DB === '1') {
    console.warn('⚠️  RESET_DB=1 detected → running prisma db push --force-reset --accept-data-loss ...');
    execSync('npx prisma db push --force-reset --accept-data-loss', {
      stdio: 'inherit',
      env: process.env as any
    });
    console.log('✅ Prisma force reset completed.');
  } else {
    // Normal light sync (no data loss)
    console.log('🔧 Applying Prisma schema (db push)');
    execSync('npx prisma db push', { stdio: 'inherit', env: process.env as any });
  }
} catch (e) {
  console.error('❌ Prisma push/reset failed:', e);
  // Do not exit — app can still start if schema already matches
}

// Start the API
console.log('🚀 Starting API');
import('./server.js');
