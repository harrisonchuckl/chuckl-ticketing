# Build & run the backend service from /backend
# Use Debian (has OpenSSL) so Prisma is happy
FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only backend deps first (cache-friendly)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend code (includes prisma/)
COPY backend ./backend

WORKDIR /app/backend

# 👉 Use a one-off dummy DB URL ONLY for generate (build-time), not as ENV.
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate && npm run build

# Runtime env (Railway will inject real DATABASE_URL)
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Run migrations at container start (uses Railway's real DATABASE_URL), then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
