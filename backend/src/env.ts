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

const printfulEnv = {
  OAUTH_TOKEN_ENCRYPTION_KEY: process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
  PRINTFUL_CLIENT_ID: process.env.PRINTFUL_CLIENT_ID,
  PRINTFUL_CLIENT_SECRET: process.env.PRINTFUL_CLIENT_SECRET,
  PRINTFUL_REDIRECT_URI: process.env.PRINTFUL_REDIRECT_URI,
};

const hasPrintfulEnv = Object.values(printfulEnv).some((value) => Boolean(value?.trim()));
if (hasPrintfulEnv) {
  const missing = Object.entries(printfulEnv)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`[env] Missing Printful OAuth env vars: ${missing.join(", ")}`);
  }
}
