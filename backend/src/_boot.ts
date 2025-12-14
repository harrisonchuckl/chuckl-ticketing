<<<<<<< Updated upstream
cd ~/Projects/chuckl-ticketing/backend

cat > src/_boot.ts <<'EOF'
=======
>>>>>>> Stashed changes
process.on('uncaughtException', (err: any) => {
  console.error('[uncaughtException]', err);
  try { console.error('[uncaughtException JSON]', JSON.stringify(err, null, 2)); } catch {}
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection]', reason);
  try { console.error('[unhandledRejection JSON]', JSON.stringify(reason, null, 2)); } catch {}
  process.exit(1);
});

import('./server.ts').catch((e) => {
  console.error('[server import failed]', e);
  try { console.error('[server import failed JSON]', JSON.stringify(e, null, 2)); } catch {}
  process.exit(1);
});
<<<<<<< Updated upstream
EOF
=======
>>>>>>> Stashed changes
