# Build & run the backend service from /backend
# Use Debian (has OpenSSL) so Prisma is happy
FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only backend deps first (cache-friendly)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend code (includes prisma/)
COPY backend ./backend

WORKDIR /app/backend

# 👉 Use a one-off dummy DB URL ONLY for generate (build-time), not as ENV.
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate && npm run build

# Runtime env (Railway will inject real DATABASE_URL)
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Run migrations at container start (uses Railway's real DATABASE_URL), then start server
# Build-time generate already done above (with a one-off dummy URL).
# At runtime, if DATABASE_URL is missing, construct it from PG* vars.
CMD ["sh", "-c", "\
  echo '--- ENV CHECK (first 30 vars) ---'; env | sort | head -n 30; \
  if [ -z \"$DATABASE_URL\" ]; then \
    if [ -n \"$PGUSER\" ] && [ -n \"$PGPASSWORD\" ] && [ -n \"$PGHOST\" ] && [ -n \"$PGPORT\" ] && [ -n \"$PGDATABASE\" ]; then \
      export DATABASE_URL=\"postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$PGDATABASE?schema=public\"; \
      echo 'ℹ️ DATABASE_URL was missing; constructed from PG* vars.'; \
    else \
      echo '❌ DATABASE_URL missing and PG* pieces not present.'; \
      env | sort; \
      exit 1; \
    fi; \
  else \
    echo '✅ DATABASE_URL present'; \
  fi; \
  npx prisma migrate deploy && node dist/server.js \
"]
