import 'dotenv/config';
import { z } from 'zod';

export const Env = z.object({
  DISCORD_TOKEN: z.string().min(30),
  DISCORD_CLIENT_ID: z.string().min(10),
  DEV_GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().default('file:./dev.db'),
  LOG_LEVEL: z.string().default('info'),
  SENTRY_DSN: z.string().optional(),
  PRESENCE_TEXT: z.string().optional(),
  PRESENCE_TYPE: z.enum(['PLAYING', 'LISTENING', 'WATCHING', 'COMPETING']).default('PLAYING'),
  PRISMA_CLIENT_ENGINE_TYPE: z.string().optional(),
  STAFF_ROLE_ID: z.string().optional(),   // <---
}).parse(process.env);
