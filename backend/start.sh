#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Boot: applying Prisma schema to ${DATABASE_URL:-<unset>}"
echo "   NODE_ENV=${NODE_ENV:-unset}  PRISMA_FORCE_RESET=${PRISMA_FORCE_RESET:-unset}"

run_db_sync() {
  if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations 2>/dev/null | wc -l)" -gt "0" ]; then
    echo "➡️  Running: npx prisma migrate deploy"
    npx prisma migrate deploy
  else
    echo "➡️  No migrations found. Running: npx prisma db push"
    npx prisma db push
  fi
}

if [ "${PRISMA_FORCE_RESET:-false}" = "true" ]; then
  echo "⚠️  PRISMA_FORCE_RESET=true — running destructive reset (all data will be LOST)"
  if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations 2>/dev/null | wc -l)" -gt "0" ]; then
    npx prisma migrate reset --force --skip-seed
  else
    npx prisma db push --force-reset
  fi
else
  set +e
  run_db_sync
  code=$?
  set -e
  if [ $code -ne 0 ]; then
    echo ""
    echo "❌ Prisma could not update the database non-destructively."
    echo "   Common cause: a column type change (e.g., Ticket.status) that requires a migration."
    echo "   Options:"
    echo "   1) Set PRISMA_FORCE_RESET=true for a one-off deploy to drop/recreate schema (will wipe data)."
    echo "   2) Create a proper migration to transform the column safely (recommended)."
    echo ""
    exit $code
  fi
fi

echo "🚀 Starting API on ${PORT:-4000}"
node dist/server.js
