import { Client, Events } from 'discord.js';
import { xpStore } from '../services/xp/store.js';
import { Context } from '../infra/context.js';

export function registerReactionTracker(client: Client) {
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        // Ignorar bots
        if (user.bot) return;

        // Garantir que é em uma guilda
        if (!reaction.message.inGuild()) return;

        const guildId = reaction.message.guildId;
        const userId = user.id;

        // Chamamos addMessageXP para reutilizar a lógica de cooldown (60s)
        // Assim, spam de reações não gera XP infinito
        // E compartilhar cooldown com mensagens evita farming excessivo
        try {
            const result = await xpStore.addMessageXP(guildId, userId);

            if (result.levelUp) {
                Context.get().logger.info({ guildId, userId, newLevel: result.newLevel }, 'User leveled up via Reaction');
            }
        } catch (err) {
            Context.get().logger.error({ err }, 'Failed to add reaction XP');
        }
    });

    Context.get().logger.info('✅ Reaction Tracker registrado');
}
