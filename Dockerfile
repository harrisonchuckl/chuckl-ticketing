# --- build image ---
FROM node:20-bullseye-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Ensure devDeps install during build (types, etc.)
ENV NODE_ENV=development

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY backend ./backend

WORKDIR /app/backend
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate
RUN npm run build

# --- runtime image ---
FROM node:20-bullseye-slim
WORKDIR /app/backend

COPY --from=build /app/backend /app/backend

ENV NODE_ENV=production
EXPOSE 4000

# Apply migrations if present; else push schema; then start
CMD sh -c 'npx prisma migrate deploy || npx prisma db push; node dist/start.js'
