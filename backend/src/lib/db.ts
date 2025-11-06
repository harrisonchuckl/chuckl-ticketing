// backend/src/lib/db.ts
import { PrismaClient } from '@prisma/client';

// Simple singleton to avoid multiple clients in dev / hot-reload
let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

if (process.env.NODE_ENV !== 'production') {
  if (!global.__PRISMA__) {
    global.__PRISMA__ = new PrismaClient();
  }
  prisma = global.__PRISMA__;
} else {
  prisma = new PrismaClient();
}

export { prisma };
export default prisma;
