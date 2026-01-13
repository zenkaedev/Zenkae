// src/index.ts
import { Client, GatewayIntentBits, Events, ActivityType, REST, Routes } from 'discord.js';

// 👇 Checagem das variáveis de ambiente ANTES de importar Prisma
const must = (name: string) => {
  const v = process.env[name];
  console.log(`[env] ${name}:`, !!v); // não mostra valor real
  if (!v) throw new Error(`Faltando variável: ${name}`);
  return v;
};

must('DISCORD_TOKEN');
must('DATABASE_URL'); // precisa estar true aqui

// Debug rápido da URL (pra confirmar host/porta/params)
// Debug rápido da URL (pra confirmar host/porta/params)
try {
  const u = new URL(process.env.DATABASE_URL!);
  // logger no loga aqui ainda pois não foi inciado
  // console.log('[db url]', u.hostname, u.port || '(5432)', u.search || '(sem params)');
} catch {
  // ignore
}

import { Env } from './env.js';
import { registerInteractionRouter } from './listeners/interactions.js';
import { startEventReminders } from './scheduler/eventsReminder.js';
import { registerMessageCounter } from './listeners/messageCount.js';
import { PrismaClient } from '@prisma/client';
import { loadCommands } from './commands/index.js';
import { registerVoiceActivity } from './listeners/voiceActivity.js';
import { Context } from './infra/context.js';
import { logger } from './infra/logger.js';


const prisma = new PrismaClient();
let clientRef: Client | null = null;

async function bootstrap() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });
  clientRef = client;

  // Init Context
  Context.init({
    client,
    prisma,
    logger,
    env: Env
  });

  // Warm-up do DB (sem prepared statement)
  try {
    await prisma.$executeRawUnsafe('SELECT 1');
    logger.info('✅ Prisma conectado');
  } catch (err) {
    logger.error({ err }, '❌ Falha ao conectar no Prisma');
    throw err;
  }

  client.once(Events.ClientReady, async (c) => {
    logger.info(`✅ Logado como ${c.user.tag}`);

    if (Env.PRESENCE_TEXT) {
      const map: Record<string, ActivityType> = {
        PLAYING: ActivityType.Playing,
        LISTENING: ActivityType.Listening,
        WATCHING: ActivityType.Watching,
        COMPETING: ActivityType.Competing,
      };
      const type = map[Env.PRESENCE_TYPE] ?? ActivityType.Playing;

      c.user.setPresence({
        activities: [{ name: Env.PRESENCE_TEXT, type }],
        status: 'online',
      });
    }

    if (Env.DEPLOY_ON_BOOT) {
      try {
        const rest = new REST({ version: '10' }).setToken(Env.DISCORD_TOKEN);
        const clientId = Env.CLIENT_ID || c.user.id;

        const commands = await loadCommands();
        logger.info(`🧩 Comandos carregados: ${commands.length}`);
        if (commands.length > 0) {
          logger.info(`🔁 Publicando ${commands.length} comandos (GLOBAL)...`);
          await rest.put(Routes.applicationCommands(clientId), { body: commands });
          logger.info('✅ Deploy global concluído.');
        } else {
          logger.warn('⚠️ Nenhum comando para publicar — pulando deploy global.');
        }
      } catch (err) {
        logger.error({ err }, '❌ Erro ao fazer deploy global:');
      }
    }

    // Initialize ZK Event Scheduler
    try {
      const { eventScheduler } = await import('./services/events/scheduler.js');
      eventScheduler.init(client);
    } catch (err) {
      logger.error({ err }, 'Error initializing event scheduler');
    }
    startEventReminders(client);
  });

  registerMessageCounter(client);
  await registerInteractionRouter(client);
  registerVoiceActivity(client, prisma);

  const { registerMembersListeners } = await import('./listeners/members.js');
  registerMembersListeners(client);

  const { registerInviteTracker } = await import('./listeners/invites.js');
  registerInviteTracker(client);

  const { registerReactionTracker } = await import('./listeners/reactions.js');
  registerReactionTracker(client);

  await client.login(Env.DISCORD_TOKEN);
}

bootstrap().catch((err) => {
  logger.fatal({ error: err }, 'Fatal bootstrap error - Bot cannot start');
  process.exit(1);
});

