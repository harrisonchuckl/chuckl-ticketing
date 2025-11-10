# ---------- builder ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Build tools (sharp needs these at build time)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Copy manifests first for caching
COPY backend/package*.json ./backend/
WORKDIR /app/backend

# Install deps (dev + prod) to build TS
# Use npm install so we don't choke on an out-of-sync lockfile
RUN npm install

# Copy source and build
COPY backend ./
RUN npx prisma generate && npm run build

# Prune dev deps so the runtime stays slim
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Bring only what's needed at runtime
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist         ./dist
COPY --from=builder /app/backend/prisma       ./prisma
COPY --from=builder /app/backend/package.json ./package.json

ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["/nodejs/bin/node", "dist/server.js"]
