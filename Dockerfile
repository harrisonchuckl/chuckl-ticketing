# ---------- builder ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Build tools for sharp
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Install deps
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# Build
COPY backend ./
RUN npx prisma generate && npm run build

# Keep only prod deps
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app/backend

COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist         ./dist
COPY --from=builder /app/backend/prisma       ./prisma
COPY --from=builder /app/backend/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# IMPORTANT: distroless already ENTRYPOINTs to node,
# so only pass the script path here.
CMD ["dist/server.js"]
