// backend/src/start.ts
import 'dotenv/config';

// No runtime prisma db push here – the DB is already in sync on Railway.
// We just start the API server.
await import('./server.js');
