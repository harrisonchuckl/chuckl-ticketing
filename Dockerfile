# Build & run the backend service from /backend
FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps (backend only)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend code (includes prisma/)
COPY backend ./backend
WORKDIR /app/backend

# Build-time generate with a dummy URL (no DB connection needed)
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# 🔥 TEMP: Force a working DB URL at runtime so the app boots.
# Replace ONLY the password if your DB string differs.
CMD ["sh", "-c", "\
  export DATABASE_URL='postgresql://postgres:YMVnkxQWYsjpsRQQgmPZaMBaEiJDKJFr@postgres.railway.internal:5432/railway?schema=public'; \
  echo '✅ Using hardcoded DATABASE_URL for startup'; \
  npx prisma migrate deploy && node dist/server.js \
"]
