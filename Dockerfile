# ---- Build image ----
FROM node:20-bullseye-slim

# OpenSSL for Prisma engine compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better caching)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy the code
COPY backend ./backend
WORKDIR /app/backend

# Generate Prisma client with a dummy DB URL (codegen only)
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate

# Build TypeScript (produces dist/server.js and dist/start.js)
RUN npm run build

# Runtime env
ENV NODE_ENV=production
ENV PORT=4000

# Start via the wrapper (dist/start.js)
CMD ["node", "dist/start.js"]
