# ---------- base images ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend

# Copy package manifests and Prisma schema first for deterministic caching
COPY backend/package*.json ./ 
COPY backend/prisma ./prisma

# Install only prod deps, skip lifecycle scripts during image build
RUN (npm ci --omit=dev --ignore-scripts || npm install --omit=dev --no-audit --no-fund --ignore-scripts)

# Generate Prisma Client against prod node_modules
RUN npx prisma generate --schema=prisma/schema.prisma

# ---------- builder (build TS) ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Tooling for native addons (e.g. sharp)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Install all deps for building, but skip running scripts (we'll run prisma generate explicitly)
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && (npm ci --ignore-scripts || npm install --no-audit --no-fund --ignore-scripts)

# Copy full backend source
COPY backend ./backend

# Ensure Prisma Client matches current schema
RUN cd backend && npx prisma generate --schema=prisma/schema.prisma

# Build TS -> dist
RUN cd backend && npm run build

# ---------- runtime (distroless) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Copy compiled JS
COPY --from=builder /app/backend/dist ./dist

# Copy runtime node_modules and Prisma schema/client
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 4000
CMD ["dist/start.js"]
