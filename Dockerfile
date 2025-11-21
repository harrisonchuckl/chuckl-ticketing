# ---------- prod deps (install node_modules + generate Prisma client) ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend

# Copy package manifests and Prisma schema first (cache-friendly)
COPY backend/package*.json ./
COPY backend/prisma ./prisma

# Install ALL deps here (prod + dev) so Prisma has everything it wants
# and we get a fully-populated node_modules including @prisma/client.
RUN (npm ci --ignore-scripts || npm install --no-audit --no-fund --ignore-scripts)

# Generate Prisma client ONCE in this stage
RUN npx prisma generate --schema=prisma/schema.prisma


# ---------- builder (build TypeScript using deps from proddeps) ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app/backend

# Native build prerequisites (sharp etc.) – be tolerant of flaky mirrors on Railway
RUN apt-get update || true \
  && apt-get install -y --no-install-recommends --fix-missing \
       python3 build-essential ca-certificates openssl || true \
  && rm -rf /var/lib/apt/lists/* || true

# Re-use node_modules (including generated Prisma client) from proddeps
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/prisma ./prisma

# Copy the rest of the backend source (includes TS, public/static etc.)
COPY backend ./ 

# If you prefer, you can add a dev-only install here, but it's usually not needed
# because proddeps already installed all deps including dev.
# RUN (npm ci --ignore-scripts || npm install --no-audit --no-fund --ignore-scripts)

# Build TS -> dist (tsconfig set to emit even if types complain)
RUN npm run build


# ---------- runtime (distroless, tiny) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

# Copy compiled JS
COPY --from=builder /app/backend/dist ./dist

# Copy prisma schema, generated client and node_modules from proddeps
COPY --from=proddeps /app/backend/node_modules ./node_modules
COPY --from=proddeps /app/backend/prisma ./prisma

# Copy static assets (CSS/JS) for the seating builder
COPY --from=builder /app/backend/public ./public

ENV NODE_ENV=production
EXPOSE 4000
CMD ["dist/start.js"]
