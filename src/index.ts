import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { Env } from './env';
import { registerInteractionRouter } from './listeners/interactions';
import { startEventReminders } from './scheduler/eventsReminder';
import { registerMessageCounter } from './listeners/messageCount'; // <= nome do arquivo
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function bootstrap() {
  // Warm-up do DB
  await prisma.$queryRaw`SELECT 1`;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages, // necessário para ouvir MessageCreate
      GatewayIntentBits.GuildMembers,  // (opcional) para conseguir joinedAt no card
    ],
  });

  client.once(Events.ClientReady, (c) => {
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

    startEventReminders(client);
  });

  // Listeners
  registerMessageCounter(client);
  registerInteractionRouter(client);

  await client.login(Env.DISCORD_TOKEN);
}

bootstrap().catch((err) => {
  console.error('DB bootstrap error:', err);
  process.exit(1);
});
