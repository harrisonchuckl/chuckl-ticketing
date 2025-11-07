# ---------- build stage ----------
FROM node:20-bullseye-slim AS build

WORKDIR /app

# Some libs (openssl used by Prisma & Stripe)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install deps for backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# Copy source
COPY backend ./ 

# Generate Prisma client (use a dummy DB URL at build time)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/notused"
RUN npx prisma generate

# TypeScript build -> dist/
RUN npm run build


# ---------- runtime stage ----------
FROM node:20-bullseye-slim AS runtime

WORKDIR /app/backend

# Minimal runtime packages
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Bring compiled app + node_modules + prisma
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package*.json ./

# Startup script to run prisma migrate/db push then start server
COPY backend/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
EXPOSE 4000

CMD ["./start.sh"]
