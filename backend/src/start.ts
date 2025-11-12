/* A tolerant launcher that works whether server exports:
   - createServer(): Promise<Express>
   - default(): Promise<Express>
   - app (Express instance)
*/
import type { Express } from 'express';

async function loadApp(): Promise<Express> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('./server');

  if (typeof mod.createServer === 'function') {
    const app = await mod.createServer();
    return app as Express;
  }
  if (typeof mod.default === 'function') {
    const app = await mod.default();
    return app as Express;
  }
  if (mod.app && typeof mod.app.listen === 'function') {
    return mod.app as Express;
  }

  throw new Error('Could not resolve an Express app from ./server');
}

(async () => {
  try {
    const app = await loadApp();
    const port = process.env.PORT ? Number(process.env.PORT) : 4000;
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] listening on http://0.0.0.0:${port}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] failed to start', err);
    process.exit(1);
  }
})();
