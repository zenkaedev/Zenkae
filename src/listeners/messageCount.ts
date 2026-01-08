// src/listeners/messageCount.ts
import { Client, Events, MessageFlags } from 'discord.js';
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
      // Integração com sistema XP
      try {
        const result = await xpStore.addMessageXP(guildId, userId);

        if (result.levelUp) {
          Context.get().logger.info({ guildId, userId, newLevel: result.newLevel }, 'User leveled up');

          // Enviar mensagem de parabéns (efêmera, só o usuário vê)
          try {
            const xpNeeded = Math.floor(100 * Math.pow(result.newLevel + 1, 1.5));

            const reply = await msg.reply({
              embeds: [{
                color: 0xFFD700, // Dourado
                title: '🎉 LEVEL UP! 🎉',
                description: `Parabéns, ${msg.author}! Você alcançou o **Nível ${result.newLevel}**!`,
                image: {
                  url: 'https://i.imgur.com/uh1X2YI.gif'
                },
                fields: [
                  {
                    name: '✨ Novo Nível',
                    value: `**${result.newLevel}**`,
                    inline: true
                  },
                  {
                    name: '🎯 Próximo Objetivo',
                    value: `Nível ${result.newLevel + 1} (${xpNeeded.toLocaleString()} XP)`,
                    inline: true
                  }
                ],
                footer: {
                  text: 'Esta mensagem será apagada em 10 segundos.'
                }
              }]
            });

            // Auto-delete após 10 segundos
            setTimeout(() => {
              reply.delete().catch(() => { });
            }, 10000);
          } catch (err) {
            Context.get().logger.error({ err }, 'Failed to send level up notification');
          }
        }
      } catch (err) {
        Context.get().logger.error({ err, guildId, userId }, 'Failed to add XP');
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
