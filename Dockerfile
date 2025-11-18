# ---------- prod deps (only production node_modules) ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend

# Ensure Prisma doesn't die if its checksum endpoint 500s
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Copy package manifests and Prisma schema first (cache-friendly)
COPY backend/package*.json ./
COPY backend/prisma ./prisma

# Install prod deps (no scripts to avoid prisma running before we say so)
RUN (npm ci --omit=dev --ignore-scripts || npm install --omit=dev --no-audit --no-fund --ignore-scripts)

# Generate Prisma client against prod node_modules
RUN npx prisma generate --schema=prisma/schema.prisma

# ---------- builder (dev deps + build TS) ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Native build prerequisites (sharp etc.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Install all deps for building TS (no scripts yet)
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && (npm ci --ignore-scripts || npm install --no-audit --no-fund --ignore-scripts)

# Copy the rest of the backend source (includes /public/static)
COPY backend ./backend

# Ensure Prisma checksum issues don't break this stage either
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Generate Prisma client (again in builder context)
RUN cd backend && npx prisma generate --schema=prisma/schema.prisma

# Build TS -> dist (tsconfig set to emit even if types complain)
RUN cd backend && npm run build

# ---------- runtime (distroless, tiny) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Copy compiled JS
COPY --from=builder /app/backend/dist ./dist

# Copy prisma schema and generated client + prod node_modules
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/prisma ./prisma

# ✅ NEW: copy static assets (CSS/JS) for the seating builder
COPY --from=builder /app/backend/public ./public

ENV NODE_ENV=production
EXPOSE 4000
CMD ["dist/start.js"]
