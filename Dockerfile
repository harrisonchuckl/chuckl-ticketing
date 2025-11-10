# ---------- builder ----------
FROM node:20-bullseye-slim AS builder

# System deps needed for native modules like sharp
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend package manifests first for better caching
COPY backend/package*.json ./backend/

# Install all deps (include dev deps for tsc)
WORKDIR /app/backend
# Use npm install instead of `ci` to avoid lock mismatch failures during rapid iteration
RUN npm install

# Copy source
COPY backend ./ 

# Ensure Prisma client is generated with correct binaryTarget (schema includes debian-openssl-3.0.x)
RUN npx prisma generate

# TypeScript build -> dist/
RUN npm run build

# ---------- prod deps ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend
COPY backend/package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

# ---------- runtime ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot

ENV NODE_ENV=production
WORKDIR /app/backend

# Copy built app
COPY --from=builder /app/backend/dist ./dist

# Copy schema + generated Prisma + production node_modules
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=proddeps /app/backend/node_modules ./node_modules

# IMPORTANT: also copy the generated prisma client directory
# (lives inside node_modules/.prisma and @prisma/client)
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/node_modules/@prisma ./node_modules/@prisma

# Port (Railway will map automatically)
EXPOSE 4000

# Distroless node image uses Node as entrypoint; just pass the JS file
# Adjust the path if your server entry is different.
CMD ["dist/index.js"]
