# ---------- builder (dev deps + compile + prisma generate) ----------
FROM node:20-bullseye-slim AS builder

WORKDIR /app/backend

# system libs needed to build native deps (e.g. sharp) and prisma engines
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# install with dev deps (prisma CLI is a devDep)
COPY backend/package*.json ./
RUN npm install

# copy source + schema and generate prisma client (OpenSSL 3 target already set)
COPY backend ./
RUN npx prisma generate

# build TypeScript -> dist/
RUN npm run build

# ---------- proddeps (only prod node_modules to keep image small) ----------
FROM node:20-bullseye-slim AS proddeps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# ---------- runtime (distroless) ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot

WORKDIR /app/backend

# app dist (compiled JS)
COPY --from=builder /app/backend/dist ./dist

# only production dependencies
COPY --from=proddeps /app/backend/node_modules ./node_modules

# copy the generated prisma client + engines from the builder
# (this is the critical bit that fixes "@prisma/client did not initialize yet")
COPY --from=builder /app/backend/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma

# (optional) copy schema for introspection/migrations if you use them at runtime
# COPY --from=builder /app/backend/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Distroless already has node as ENTRYPOINT; give it the script only.
CMD ["dist/start.js"]
