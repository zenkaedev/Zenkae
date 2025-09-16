// src/index.ts
import { Client, GatewayIntentBits, Events, ActivityType, REST, Routes } from 'discord.js';
import { Env } from './env.js';
import { registerInteractionRouter } from './listeners/interactions.js';
import { startEventReminders } from './scheduler/eventsReminder.js';
import { registerMessageCounter } from './listeners/messageCount.js';
import { PrismaClient } from '@prisma/client';
import { loadCommands } from './commands/index.js';
import { registerVoiceActivity } from './listeners/voiceActivity.js';

const prisma = new PrismaClient();
let clientRef: Client | null = null;

async function bootstrap() {
  // Warm-up do DB
  await prisma.$queryRaw`SELECT 1`;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages, // necessário para ouvir messageCreate
      // Se você LÊ message.content, habilite também:
      // GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates, // para voiceStateUpdate
      GatewayIntentBits.GuildMembers, // (opcional) para joinedAt no card
    ],
  });
  clientRef = client;

  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Logado como ${c.user.tag}`);

    // Presença
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

    // Deploy GLOBAL (ligue com DEPLOY_ON_BOOT=true, rode uma vez e desligue)
    if (Env.DEPLOY_ON_BOOT) {
      try {
        const rest = new REST({ version: '10' }).setToken(Env.DISCORD_TOKEN);
        const clientId = Env.CLIENT_ID || c.user.id;

        const commands = await loadCommands();
        console.log(`🧩 Comandos carregados: ${commands.length}`);
        if (commands.length === 0) {
          console.warn('⚠️ Nenhum comando para publicar — pulando deploy global.');
        } else {
          console.log(`🔁 Publicando ${commands.length} comandos (GLOBAL)...`);
          await rest.put(Routes.applicationCommands(clientId), { body: commands });
          console.log('✅ Deploy global concluído.');
        }

        // (Opcional) limpar comandos por guild antigos:
        // if (Env.DEV_GUILD_ID) {
        //   await rest.put(Routes.applicationGuildCommands(clientId, Env.DEV_GUILD_ID), { body: [] });
        //   console.log('🧹 Guild commands antigos limpos.');
        // }
      } catch (err) {
        console.error('❌ Falha no deploy global:', err);
      }
    }

    startEventReminders(client);
  });

  // Listeners
  registerMessageCounter(client);
  registerInteractionRouter(client);
  registerVoiceActivity(client, prisma);

  await client.login(Env.DISCORD_TOKEN);
}

// Shutdown limpo
let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (clientRef) {
      try {
        await clientRef.destroy();
      } catch {}
    }
    await prisma.$disconnect();
  } finally {
    process.exit(code);
  }
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err);
  void shutdown(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason);
  void shutdown(1);
});

bootstrap().catch((err) => {
  console.error('DB/bootstrap error:', err);
  void shutdown(1);
});
