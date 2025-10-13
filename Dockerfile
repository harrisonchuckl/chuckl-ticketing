# Build & run the backend service from /backend
# Use Debian (has OpenSSL) so Prisma is happy
FROM node:20-bullseye-slim

# Optional but recommended: make sure openssl exists for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps using only backend package files
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy full backend code (incl. prisma dir)
COPY backend ./backend

WORKDIR /app/backend

# Generate Prisma client and build the app
RUN npx prisma generate && npm run build

# Expose port and set env
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# IMPORTANT: Run migrations at container start (after Railway injects env vars)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
