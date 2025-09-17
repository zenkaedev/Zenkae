// src/index.ts
import { Client, GatewayIntentBits, Events, ActivityType, REST, Routes } from 'discord.js';
import { Env } from './env.js';
import { registerInteractionRouter } from './listeners/interactions.js';
import { startEventReminders } from './scheduler/eventsReminder.js';
import { registerMessageCounter } from './listeners/messageCount.js';
// ⚠️ NÃO importar o Prisma aqui em cima – vamos importar depois da checagem de ENV
import { loadCommands } from './commands/index.js';
import { registerVoiceActivity } from './listeners/voiceActivity.js';

type PrismaClientType = import('@prisma/client').PrismaClient;

let prisma: PrismaClientType | null = null;
let clientRef: Client | null = null;

function debugEnvOrThrow() {
  const keys = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'CLIENT_ID', 'DATABASE_URL'];
  const present = Object.fromEntries(keys.map(k => [k, !!process.env[k]]));
  console.log('🔎 ENV check:', present);

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL ausente. Na Square Cloud, crie a variável exatamente como "DATABASE_URL" (sem aspas) e cole a URL COMPLETA do Neon, incluindo "?sslmode=require&channel_binding=require".'
    );
  }
}

async function warmupDB() {
  const { PrismaClient } = await import('@prisma/client'); // import dinâmico
  prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Prisma conectado');
  } catch (err) {
    console.error('❌ Prisma warm-up falhou. Verifique DATABASE_URL:', err);
    throw err;
  }
}

async function bootstrap() {
  // 1) Checa ENV ANTES de tocar no Prisma
  debugEnvOrThrow();

  // 2) Sobe DB
  await warmupDB();

  // 3) Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      // GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
  });
  clientRef = client;

  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Logado como ${c.user.tag}`);

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
        console.log(`🧩 Comandos carregados: ${commands.length}`);
        if (commands.length > 0) {
          console.log(`🔁 Publicando ${commands.length} comandos (GLOBAL)...`);
          await rest.put(Routes.applicationCommands(clientId), { body: commands });
          console.log('✅ Deploy global concluído.');
        } else {
          console.warn('⚠️ Nenhum comando para publicar — pulando deploy global.');
        }
      } catch (err) {
        console.error('❌ Falha no deploy global:', err);
      }
    }

    startEventReminders(client);
  });

  registerMessageCounter(client);
  registerInteractionRouter(client);
  if (!prisma) throw new Error('Prisma não inicializado');
  registerVoiceActivity(client, prisma);

  await client.login(Env.DISCORD_TOKEN);
}

// Shutdown limpo
let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (clientRef) { try { await clientRef.destroy(); } catch {} }
    if (prisma) { try { await prisma.$disconnect(); } catch {} }
  } finally {
    process.exit(code);
  }
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('uncaughtException', (err) => { console.error('💥 uncaughtException:', err); void shutdown(1); });
process.on('unhandledRejection', (reason) => { console.error('💥 unhandledRejection:', reason); void shutdown(1); });

bootstrap().catch((err) => {
  console.error('DB/bootstrap error:', err);
  void shutdown(1);
});
