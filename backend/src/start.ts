import { createServer } from './server';

(async () => {
  try {
    const app = await createServer();
    const port = process.env.PORT ? Number(process.env.PORT) : 4000;
    app.listen(port, () => {
      console.log(`[server] listening on http://0.0.0.0:${port}`);
    });
  } catch (err) {
    console.error('[server] failed to start', err);
    process.exit(1);
  }
})();
