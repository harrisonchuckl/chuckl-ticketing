# ---- Base Node image ----
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files first (for efficient caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend source code
COPY . .

# ---- Build the TypeScript project ----
RUN npm run build

# ---- Final runtime image ----
FROM node:20-alpine

WORKDIR /app

# Copy built files and node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Set environment variable for Prisma
ENV DATABASE_URL="postgresql://postgres:CwWQWeXByqgiYRLsxKzxhdCVvtvggQvY@shortline.proxy.rlwy.net:35923/railway"
ENV NODE_ENV=production
ENV PORT=8080

# Expose the Railway port
EXPOSE 8080

# Run Prisma migrations automatically, then start the app
CMD ["sh", "-c", "\
  echo '✅ Using hardcoded DATABASE_URL for startup'; \
  npx prisma migrate deploy && \
  node dist/server.js \
"]
