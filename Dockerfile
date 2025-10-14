# ===========================
# CHUCKL TICKETING DOCKERFILE
# ===========================

# ---- Base image ----
FROM node:20-bullseye-slim

# Install OpenSSL (required for Prisma)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# ---- Install dependencies ----
# Copy only package files first for better caching
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# ---- Copy source code ----
COPY backend ./backend

# Set working directory to backend
WORKDIR /app/backend

# ---- Generate Prisma client and build TypeScript ----
# This uses a dummy DB URL just for code generation
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate && npm run build

# ---- Environment configuration ----
ENV NODE_ENV=production
ENV PORT=8080

# ---- Expose port ----
EXPOSE 8080

# ---- Start the application ----
# Here we inject your ACTUAL Railway Postgres credentials directly.
# Once it's confirmed working, we’ll move this to Railway Variables.
CMD ["sh", "-c", "\
  export DATABASE_URL='postgresql://postgres:CwWQWeXByqgiYRLsxKzxhdCVvtvggQvY@postgres.railway.internal:5432/railway?schema=public'; \
  echo '✅ Using hardcoded DATABASE_URL for startup'; \
  echo \"🔗 Connecting to: $DATABASE_URL\"; \
  npx prisma migrate deploy && \
  node dist/server.js \
"]
