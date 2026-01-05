import { Context } from '../infra/context.js';
import type { PrismaClient } from '@prisma/client';

export const prisma = new Proxy({} as any, {
  get(target, prop) {
    return (Context.get().prisma as any)[prop];
  }
}) as PrismaClient;

export default prisma;

