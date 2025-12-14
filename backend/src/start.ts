import "./env.js";
import app from "./server.js";

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
