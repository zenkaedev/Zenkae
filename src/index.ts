// src/index.ts
import { Client, GatewayIntentBits, Events, ActivityType, REST, Routes } from 'discord.js';
import { Env } from './env.js';
import { registerInteractionRouter } from './listeners/interactions.js';
import { startEventReminders } from './scheduler/eventsReminder.js';
import { registerMessageCounter } from './listeners/messageCount.js';
import { PrismaClient } from '@prisma/client';
import { loadCommands } from './commands/index.js';
import { registerVoiceActivity } from './listeners/voiceActivity.js';

let prisma: PrismaClient | null = null;
let clientRef: Client | null = null;

function debugEnv() {
  const keys = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "CLIENT_ID", "DATABASE_URL"];
  const present = keys.reduce<Record<string, boolean>>((acc, k) => {
    acc[k] = !!process.env[k];
    return acc;
  }, {});
  // DEBUG não vaza valores sensíveis
  console.log("🔎 ENV check:", present);
  if (!present.DATABASE_URL) {
    // erro explícito pra evitar mensagem confusa do Prisma
    throw new Error(
      "DATABASE_URL ausente. Cadastre em Variáveis de Ambiente da Square Cloud " +
      "(sem aspas, 1 linha, incluindo ?sslmode=require&channel_binding=require)."
    );
  }
}

async function warmupDB() {
  prisma = new PrismaClient();
  try {
    // simples SELECT 1 só pra subir o engine com a DATABASE_URL
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Prisma conectado");
  } catch (err) {
    console.error("❌ Prisma warm-up falhou. Verifique DATABASE_URL:", err);
    throw err;
  }
}

async function bootstrap() {
  // 1) Confere ENV (não imprime segredos)
  debugEnv();

  // 2) Sobe DB
  await warmupDB();

  // 3) Cria cliente do Discord
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      // GatewayIntentBits.MessageContent, // habilite se precisar ler conteúdo
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
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

    // Deploy GLOBAL opcional
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
        // Limpeza opcional de comandos por guild:
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

  // 4) Listeners
  registerMessageCounter(client);
  registerInteractionRouter(client);
  if (!prisma) throw new Error("Prisma não inicializado");
  registerVoiceActivity(client, prisma);

  // 5) Login
  await client.login(Env.DISCORD_TOKEN);
}

// Shutdown limpo
let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (clientRef) {
      try { await clientRef.destroy(); } catch {}
    }
    if (prisma) {
      try { await prisma.$disconnect(); } catch {}
    }
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
