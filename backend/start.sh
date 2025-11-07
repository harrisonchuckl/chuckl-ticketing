#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Boot: applying Prisma schema to ${DATABASE_URL:-<unset>}"

# If you have migrations, deploy them; otherwise push the current schema.
if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations 2>/dev/null | wc -l)" -gt "0" ]; then
  echo "➡️  Running: npx prisma migrate deploy"
  npx prisma migrate deploy
else
  echo "➡️  No migrations found. Running: npx prisma db push"
  npx prisma db push
fi

echo "🚀 Starting API on ${PORT:-4000}"
node dist/server.js
