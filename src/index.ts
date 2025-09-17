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
must('DATABASE_URL'); // <- a problemática
// (opcional) must('DISCORD_CLIENT_ID');

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
  try {
    await prisma.$executeRawUnsafe('SELECT 1');
    console.log('✅ Prisma conectado');
  } catch (err) {
    console.error('❌ Falha ao conectar no Prisma:', err);
    throw err;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
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
  registerVoiceActivity(client, prisma);

  await client.login(Env.DISCORD_TOKEN);
}

bootstrap().catch((err) => {
  console.error('DB/bootstrap error:', err);
  process.exit(1);
});
