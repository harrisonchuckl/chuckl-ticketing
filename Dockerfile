# ---------- builder ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install build tooling (sharp needs these at build-time)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Copy only manifests first for better caching
COPY backend/package*.json ./backend/
WORKDIR /app/backend

# Install ALL deps (incl dev) to compile TS
RUN npm ci

# Copy source and build
COPY backend ./
RUN npx prisma generate && npm run build

# ---------- prod deps ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ---------- runtime ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Copy node_modules (prod only) and compiled dist
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=builder  /app/backend/dist         ./dist
COPY --from=builder  /app/backend/prisma       ./prisma
COPY --from=builder  /app/backend/package.json ./package.json

# Prisma needs the schema at runtime for some commands; we already copied prisma/
ENV NODE_ENV=production PORT=4000

# Expose port (informational)
EXPOSE 4000

# Start the compiled server
CMD ["/nodejs/bin/node", "dist/server.js"]
