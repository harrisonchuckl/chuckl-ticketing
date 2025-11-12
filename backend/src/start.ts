import createServer from "./server.js";

const port = Number(process.env.PORT ?? 8080);

(async () => {
  const app = await Promise.resolve(createServer());
  app.listen(port, () => {
    console.log(`Backend listening on :${port}`);
  });
})();
