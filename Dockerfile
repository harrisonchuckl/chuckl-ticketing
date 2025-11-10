# ---------- builder ----------
FROM node:20-bullseye-slim AS builder

WORKDIR /app/backend

# Install build deps (sharp needs these); keep image small
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better caching
COPY backend/package*.json ./

# Install all deps (incl. dev for tsc/prisma)
RUN npm install

# Copy the rest of the backend source
COPY backend ./

# Ensure Prisma has the right engine for Railway’s Debian OpenSSL 3.0
# (Make sure prisma/schema.prisma has the generator with binaryTargets incl. debian-openssl-3.0.x)
# Then generate the client
RUN npx prisma generate

# TypeScript build -> dist/
RUN npm run build

# ---------- runtime ----------
FROM node:20-bullseye-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

# Only production deps
COPY backend/package*.json ./
RUN npm install --omit=dev

# Bring in the compiled app, prisma client, and any runtime assets
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000
CMD ["node", "dist/index.js"]
