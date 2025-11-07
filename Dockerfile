# ---- build stage ----
FROM node:20-bullseye-slim AS build

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy source
COPY backend ./backend

# Generate Prisma client (dummy URL OK at build time)
WORKDIR /app/backend
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/notused"
RUN npx prisma generate

# Build TS → JS
RUN npm run build


# ---- runtime stage ----
FROM node:20-bullseye-slim AS runtime

WORKDIR /app/backend

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy runtime artifacts
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/package*.json ./
COPY --from=build /app/backend/prisma ./prisma

# Startup script (handles Prisma migrate/db push then boots server)
COPY backend/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
EXPOSE 4000

CMD ["./start.sh"]
