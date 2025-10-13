# Build & run the backend service from /backend
# Use Debian (has OpenSSL) so Prisma is happy
FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only backend dependencies first (better layer caching)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend code (including prisma/)
COPY backend ./backend

WORKDIR /app/backend

# ---- IMPORTANT: Provide a dummy DATABASE_URL for prisma generate (no real DB needed to generate) ----
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/notused"

# Generate Prisma client and build the app
RUN npx prisma generate && npm run build

# Runtime env (Railway will inject the real DATABASE_URL)
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Run migrations at container start (when real env vars are present), then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
