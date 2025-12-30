import "./env.js";
import app from "./server.js";
import { startMarketingWorker } from "./services/marketing/worker.js";

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});

startMarketingWorker();
