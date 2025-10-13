# Build & run the backend service from the /backend folder
FROM node:20-alpine AS base
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Prisma client
COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate

# Copy backend code
COPY backend ./backend

# Build & run
WORKDIR /app/backend
# Apply DB migrations when building the image (Railway build phase)
RUN npx prisma migrate deploy && npm run build

ENV PORT=4000
EXPOSE 4000
CMD ["npm","start"]
