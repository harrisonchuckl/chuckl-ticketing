# ---------- prod deps (only production node_modules) ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend

# Copy package manifests and Prisma schema BEFORE install so prisma generate can run here
COPY backend/package*.json ./
COPY backend/prisma ./prisma

# Install prod deps only
RUN npm install --omit=dev

# Generate Prisma client against prod node_modules
RUN npx prisma generate --schema=prisma/schema.prisma

# ---------- builder (dev deps + build TS) ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Build tools needed for sharp (and friends)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Install all deps for building TS
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy the rest of the backend source (TS etc.)
COPY backend ./backend

# Prisma generate is not strictly required here because we generated it in proddeps,
# but harmless if present:
RUN cd backend && npx prisma generate --schema=prisma/schema.prisma

# Build TypeScript -> dist/
RUN cd backend && npm run build

# ---------- runtime (distroless, tiny) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Copy compiled JS
COPY --from=builder /app/backend/dist ./dist

# Copy prisma schema (optional) and generated client from proddeps
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/prisma ./prisma

# Environment (Railway sets PORT), Node distroless uses CMD arg as entry
ENV NODE_ENV=production
EXPOSE 4000
CMD ["dist/start.js"]
