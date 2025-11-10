# ---------- deps for production image ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend
# Only install prod deps for the runtime layer
COPY backend/package*.json ./
RUN npm install --omit=dev

# ---------- builder (TypeScript -> dist) ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install build tooling needed by sharp/prisma during build
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     python3 build-essential ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Install full deps for building
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# Copy source & prisma schema
COPY backend ./

# Prisma client for Debian 12 / OpenSSL 3 (you already set this in schema)
RUN npx prisma generate

# Compile TS -> JS (to dist/)
RUN npm run build

# ---------- runtime (distroless) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot

# Runtime workdir mirrors builder so relative paths match
WORKDIR /app/backend

# Bring in compiled app, prisma client, and only prod deps
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/package.json ./package.json

# Railway exposes PORT; default to 4000 in your code
EXPOSE 4000

# IMPORTANT: your entry is dist/start.js (not index.js)
CMD ["node","dist/start.js"]
