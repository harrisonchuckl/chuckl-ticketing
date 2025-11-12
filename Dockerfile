# ---------- prod deps (production node_modules + Prisma client) ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend

# Copy manifests and Prisma schema early for caching + generate
COPY backend/package*.json ./
COPY backend/prisma ./prisma

# Prefer lockfile if valid; otherwise fall back. Never run lifecycle scripts here.
RUN (npm ci --omit=dev --ignore-scripts || npm install --omit=dev --no-audit --no-fund --ignore-scripts)

# Generate Prisma client against prod deps
RUN npx prisma generate --schema=prisma/schema.prisma


# ---------- builder (dev deps + build TS) ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# (Optional) Build tools – keep if you truly need native builds (e.g. sharp)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Copy manifests and Prisma schema BEFORE installing so postinstall can't fail
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma

# Install dev deps for building, but skip lifecycle scripts to avoid premature prisma runs
RUN cd backend && (npm ci --ignore-scripts || npm install --no-audit --no-fund --ignore-scripts)

# Now copy the rest of the source
COPY backend ./backend

# Generate Prisma client for type-safe build (uses dev deps just installed)
RUN cd backend && npx prisma generate --schema=prisma/schema.prisma

# Build TS -> dist/
RUN cd backend && npm run build


# ---------- runtime (distroless, tiny) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Compiled JS
COPY --from=builder /app/backend/dist ./dist

# Production node_modules (includes @prisma/client + engines) and schema
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/prisma ./prisma

ENV NODE_ENV=production
# Railway will provide PORT; fall back handled in your app
EXPOSE 4000

# Start the app (adjust if your entrypoint differs)
CMD ["dist/start.js"]
