# ----- Base image with OpenSSL (Prisma needs it) -----
FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Work inside /app
WORKDIR /app

# ----- Install backend deps (cache-friendly) -----
# If your repo has a /backend folder (it does), copy only its package files first
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy the rest of the backend (includes prisma/)
COPY backend ./backend

# Move into backend
WORKDIR /app/backend

# ----- Build time: generate Prisma client & compile TS -----
# Use a dummy DB URL for generate only (no real connection needed)
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate && npm run build

# Runtime env
ENV NODE_ENV=production
# Railway will provide PORT=8080 at runtime; your server should read process.env.PORT

EXPOSE 8080

# ----- Runtime: use your LIVE Railway Postgres (internal host) -----
# Uses the CURRENT password you provided.
CMD ["sh", "-c", "\
  export DATABASE_URL='postgresql://postgres:CwWQWeXByqgiYRLsxKzxhdCVvtvggQvY@postgres.railway.internal:5432/railway?schema=public'; \
  echo '✅ Using hardcoded DATABASE_URL for startup'; \
  npx prisma migrate deploy && node dist/server.js \
"]
