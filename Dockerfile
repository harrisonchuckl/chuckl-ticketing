# --- build image ---
FROM node:20-bullseye-slim AS build

# minimal deps needed by some libs (openssl is often required)
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# copy sourceS
COPY backend ./backend

# generate Prisma client using a dummy URL (codegen only)
WORKDIR /app/backend
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/notused" npx prisma generate

# build TS -> dist
RUN npm run build



# --- runtime image ---
FROM node:20-bullseye-slim

WORKDIR /app/backend

# bring built app + node_modules from build stage
COPY --from=build /app/backend /app/backend

ENV NODE_ENV=production
EXPOSE 4000

# IMPORTANT: run Prisma migrations (or push) at container start, then boot the server
# If you don't have migrations yet, migrate deploy will no-op; db push will sync the schema.
CMD sh -c 'npx prisma migrate deploy || npx prisma db push; node dist/start.js'
