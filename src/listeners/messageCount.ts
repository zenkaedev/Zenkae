// src/listeners/messageCount.ts
import { Client, Events } from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Incrementa um contador por usuário/servidor sempre que alguém envia
 * uma mensagem no servidor. Requer GatewayIntentBits.GuildMessages.
 */
export function registerMessageCounter(client: Client) {
  client.on(Events.MessageCreate, async (msg) => {
    try {
      // somente mensagens em servidores e de usuários (não bots/sistema)
      if (!msg.inGuild()) return;
      if (msg.author.bot || msg.system) return;

      await prisma.messageCounter.upsert({
        where: { guildId_userId: { guildId: msg.guildId, userId: msg.author.id } },
        create: { guildId: msg.guildId, userId: msg.author.id, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch (err) {
      // loga, mas não quebra o bot
      console.error('[messageCount] erro ao incrementar contador:', err);
    }
  });
}

/** Utilitário para ler o total atual (opcional) */
export async function getMessageCount(guildId: string, userId: string) {
  const row = await prisma.messageCounter.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  return row?.count ?? 0;
}
