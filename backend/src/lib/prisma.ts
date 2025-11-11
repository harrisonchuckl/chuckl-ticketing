// backend/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export default for `import prisma from '../lib/prisma.js'`
// Also export named to avoid future breakages if other files use `{ prisma }`
export default prisma;
export { prisma };