import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { Env } from './env';
import { registerInteractionRouter } from './listeners/interactions';
import { startEventReminders } from './scheduler/eventsReminder';
import { registerMessageCounter } from './listeners/messageCount';


const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

registerMessageCounter(client);
registerInteractionRouter(client);
client.login(Env.DISCORD_TOKEN);
