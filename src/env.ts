// src/env.ts
import 'dotenv/config';
import { z } from 'zod';

/**
 * Schema cru: lê direto do process.env.
 * - Mantemos CLIENT_ID e DISCORD_CLIENT_ID (legado) e depois mesclamos.
 * - Convertemos DEPLOY_ON_BOOT para boolean.
 */
const RawEnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(30),
  CLIENT_ID: z.string().min(10).optional(),
  DISCORD_CLIENT_ID: z.string().min(10).optional(),
  DEV_GUILD_ID: z.string().optional(),

  DATABASE_URL: z.string().default('file:./dev.db'),
  SHADOW_DATABASE_URL: z.string().optional(),

  LOG_LEVEL: z.string().default('info'),
  SENTRY_DSN: z.string().optional(),

  PRESENCE_TEXT: z.string().optional(),
  PRESENCE_TYPE: z.enum(['PLAYING', 'LISTENING', 'WATCHING', 'COMPETING']).default('PLAYING'),

  PRISMA_CLIENT_ENGINE_TYPE: z.string().optional(),

  // strings "true"/"false" -> boolean
  DEPLOY_ON_BOOT: z.preprocess(
    (v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v),
    z.boolean().default(false)
  ),

  // legado / configs extras
  STAFF_ROLE_ID: z.string().optional(),
});

/**
 * Exigimos pelo menos um dos IDs (CLIENT_ID ou DISCORD_CLIENT_ID)
 * e retornamos um objeto já normalizado com CLIENT_ID final.
 */
const EnvSchema = RawEnvSchema.superRefine((val, ctx) => {
  if (!val.CLIENT_ID && !val.DISCORD_CLIENT_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLIENT_ID'],
      message: 'Você deve definir CLIENT_ID (ou DISCORD_CLIENT_ID) no .env',
    });
  }
}).transform((val) => ({
  DISCORD_TOKEN: val.DISCORD_TOKEN,

  // normalizado: usa CLIENT_ID se existir; senão DISCORD_CLIENT_ID
  CLIENT_ID: val.CLIENT_ID ?? (val.DISCORD_CLIENT_ID as string),

  DEV_GUILD_ID: val.DEV_GUILD_ID,

  DATABASE_URL: val.DATABASE_URL,
  SHADOW_DATABASE_URL: val.SHADOW_DATABASE_URL,

  LOG_LEVEL: val.LOG_LEVEL,
  SENTRY_DSN: val.SENTRY_DSN,

  PRESENCE_TEXT: val.PRESENCE_TEXT,
  PRESENCE_TYPE: val.PRESENCE_TYPE,

  PRISMA_CLIENT_ENGINE_TYPE: val.PRISMA_CLIENT_ENGINE_TYPE,

  DEPLOY_ON_BOOT: val.DEPLOY_ON_BOOT,

  // Mantemos se for usado em alguma parte do código
  STAFF_ROLE_ID: val.STAFF_ROLE_ID,
}));

export const Env = EnvSchema.parse(process.env);
export type EnvVars = typeof Env;
