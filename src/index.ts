// src/index.ts
import * as Sentry from '@sentry/node';
import { GatewayIntentBits, Client, ActivityType } from 'discord.js';
import { createLogger } from './core/logger';
import prisma from './db/prisma';
import { createBaseCtx } from './core/ctx';
import { registerRouter } from './core/router';

const logger = createLogger('bootstrap');

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  logger.info('Sentry inicializado');
}

async function main() {
  logger.info('Zenkae iniciando...');

  await prisma.$connect();
  logger.info('Prisma conectado');

  await prisma.guildConfig.count();
  logger.info('Ping DB ok');

  const ctx = createBaseCtx(logger.child({ scope: 'app' }));

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    logger.error('DISCORD_TOKEN ausente. Defina no .env');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once('ready', () => {
    logger.info({ user: client.user?.tag }, 'Cliente do Discord pronto');
    const text = process.env.PRESENCE_TEXT || 'Digitando...';
    const type = (process.env.PRESENCE_TYPE || 'PLAYING') as keyof typeof ActivityType;
    client.user?.setPresence({
      activities: [{ name: text, type: ActivityType[type] ?? ActivityType.Playing }],
      status: 'online',
    });
  });

  registerRouter(client, ctx);
  await client.login(token);
}

const shutdown = async (signal: string) => {
  logger.warn({ signal }, 'Encerrando…');
  try {
    await prisma.$disconnect();
    logger.info('Prisma desconectado');
  } catch (err) {
    logger.error({ err }, 'Erro ao desconectar Prisma');
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((err) => {
  logger.error({ err }, 'Falha no bootstrap');
  Sentry.captureException(err);
  process.exit(1);
});
