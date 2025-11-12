# ---------- prod deps (production node_modules + Prisma client) ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend

# Copy package manifests and Prisma schema first for better caching
COPY backend/package*.json ./
COPY backend/prisma ./prisma

# If you have a package-lock.json, prefer npm ci. If not, swap to `npm install --omit=dev`
RUN npm ci --omit=dev || npm install --omit=dev

# Generate Prisma client against production deps
RUN npx prisma generate --schema=prisma/schema.prisma


# ---------- builder (dev deps + build TS) ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Build tools (sharp/pdfkit sometimes need these even with prebuilt binaries)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Install all deps for TypeScript build
COPY backend/package*.json ./backend/
RUN cd backend && (npm ci || npm install)

# Copy the rest of the backend source
COPY backend ./backend

# (Harmless duplicate; ensures prisma types exist during tsc)
RUN cd backend && npx prisma generate --schema=prisma/schema.prisma

# Compile TS -> dist/
RUN cd backend && npm run build


# ---------- runtime (distroless, tiny) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Copy compiled JS
COPY --from=builder /app/backend/dist ./dist

# Copy production node_modules (includes @prisma/client and engines) and schema
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/prisma ./prisma

ENV NODE_ENV=production
# Railway will set PORT; your server should read it or default to 4000
EXPOSE 4000

# Start the app (update if your entry point is different)
CMD ["dist/start.js"]
