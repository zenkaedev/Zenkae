import { Client, Events } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export function registerMessageCounter(client: Client) {
  client.on(Events.MessageCreate, async (msg) => {
    try {
      if (!msg.inGuild() || msg.author.bot) return;
      await prisma.messageCounter.upsert({
        where: { guildId_userId: { guildId: msg.guildId, userId: msg.author.id } },
        create: { guildId: msg.guildId, userId: msg.author.id, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch {}
  });
}

export async function getMessageCount(guildId: string, userId: string) {
  const r = await prisma.messageCounter.findUnique({ where: { guildId_userId: { guildId, userId } } });
  return r?.count ?? 0;
}
