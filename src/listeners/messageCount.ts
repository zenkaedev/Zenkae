// src/listeners/messageCount.ts
import { Client, Events } from 'discord.js';
import { Context } from '../infra/context.js';
import { xpStore } from '../services/xp/store.js';

const prisma = new Proxy({} as any, {
  get(target, prop) {
    return (Context.get().prisma as any)[prop];
  }
});

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

      const guildId = msg.guildId;
      const userId = msg.author.id;

      // 1. Incrementar contador de mensagens
      await prisma.messageCounter.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: { guildId, userId, count: 1 },
        update: { count: { increment: 1 } },
      });

      // 2. Adicionar XP (com cooldown de 60s)
      try {
        const { levelUp, newLevel } = await xpStore.addMessageXP(guildId, userId);
        if (levelUp) {
          Context.get().logger.info({ guildId, userId, newLevel }, 'User leveled up');
        }
      } catch (xpErr) {
        // Não deixa falha de XP quebrar o contador
        Context.get().logger.error({ err: xpErr }, 'Failed to add XP');
      }
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
