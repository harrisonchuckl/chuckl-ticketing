// backend/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient across hot reloads (dev) and once (prod).
 * We default-export it so you can `import prisma from '../lib/prisma.js'`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
