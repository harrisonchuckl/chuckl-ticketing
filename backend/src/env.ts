import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Loads env files for local dev. In production (Railway), process.env is provided by the platform.
// We do NOT override existing env vars.
const root = process.cwd();
const candidates = [".env.local", ".env"];

for (const name of candidates) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
  }
}
