// src/db/prisma.ts
// -----------------------------------------------------------------------------
// Cliente Prisma singleton (evita múltiplas conexões em dev com tsx --watch)
// -----------------------------------------------------------------------------
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const isProd = process.env.NODE_ENV === 'production';

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    // Logs básicos; ajuste conforme seu logger (pino) depois
    log: isProd ? ['error'] : ['query', 'warn', 'error'],
  });

if (!isProd) {
  global.__prisma__ = prisma;
}

export default prisma;
