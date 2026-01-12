// src/modules/suggestions/dashboard.ts
import type { ButtonInteraction } from 'discord.js';
import { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { suggestionStore } from './store.js';
import { buildSuggestionPanel } from './panel.public.js';
import { logger } from '../../infra/logger.js';
import { handleError } from '../../infra/errors.js';
import { InteractionRouter } from '../../infra/router.js';
import { renderDashboard } from '../../container.js';
import { safeUpdate } from '../../ui/v2.js';

export const suggestionDashRouter = new InteractionRouter();

/* ----------------------------- PUBLISH PANEL ----------------------------- */

suggestionDashRouter.button('suggestions:publish', async (i: ButtonInteraction) => {
    await i.deferUpdate();

    try {
        if (!i.guild) return;

        // Fix #1: Permission check
        if (!i.member || typeof i.member === 'string') {
            await i.followUp({
                content: '❌ Erro ao verificar permissões.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const permissions = i.member.permissions;
        if (typeof permissions === 'string' || !permissions.has(PermissionFlagsBits.ManageGuild)) {
            await i.followUp({
                content: '❌ Você não tem permissão para fazer isso. (Requer: Gerenciar Servidor)',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const settings = await suggestionStore.getSettings(i.guild.id);

        if (!settings.suggestionsChannelId) {
            await i.followUp({
                content: 'Configure primeiro o canal de sugestoes antes de publicar o painel.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Fetch channel
        const channel = await i.guild.channels.fetch(settings.suggestionsChannelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            await i.followUp({
                content: 'Canal de sugestoes nao encontrado ou invalido.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Build and send panel
        const panel = buildSuggestionPanel();
        const message = await channel.send(panel);

        // Save message ID
        await suggestionStore.updateSettings(i.guild.id, {
            panelChannelId: channel.id,
            panelMessageId: message.id
        });

        logger.info({
            guildId: i.guild.id,
            channelId: channel.id,
            messageId: message.id
        }, 'Suggestions panel published');

        // Refresh dashboard
        const updated = await renderDashboard({ tab: 'suggestions', guildId: i.guild.id });
        await safeUpdate(i, updated);

        await i.followUp({
            content: `Painel publicado em ${channel.toString()}!`,
            flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        logger.error({ error: err, userId: i.user.id }, 'Error publishing suggestions panel');
        await handleError(i, err);
    }
});

/* ----------------------------- SET CHANNEL ----------------------------- */

suggestionDashRouter.button('suggestions:setChannel', async (i: ButtonInteraction) => {
    await i.deferUpdate();

    try {
        // Fix #1: Permission check
        if (!i.member || typeof i.member === 'string') {
            await i.followUp({
                content: '❌ Erro ao verificar permissões.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const perms = i.member.permissions;
        if (typeof perms === 'string' || !perms.has(PermissionFlagsBits.ManageGuild)) {
            await i.followUp({
                content: '❌ Você não tem permissão para fazer isso. (Requer: Gerenciar Servidor)',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const row = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('suggestions:selectChannel')
                    .setPlaceholder('Selecione o canal para sugestoes')
                    .addChannelTypes(ChannelType.GuildText)
            );

        await i.followUp({
            content: 'Selecione o canal onde as sugestoes serao enviadas:',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        logger.error({ error: err }, 'Error showing channel select');
        await handleError(i, err);
    }
});

suggestionDashRouter.select('suggestions:selectChannel', async (i) => {
    await i.deferUpdate();

    try {
        if (!i.guild || !i.isChannelSelectMenu()) return;

        const channelId = i.values[0];
        const channel = await i.guild.channels.fetch(channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            await i.editReply({
                content: 'Canal invalido.',
                components: []
            });
            return;
        }

        // Save settings
        await suggestionStore.updateSettings(i.guild.id, {
            suggestionsChannelId: channelId
        });

        logger.info({
            guildId: i.guild.id,
            channelId
        }, 'Suggestions channel configured');

        await i.editReply({
            content: `Canal de sugestoes configurado: ${channel.toString()}`,
            components: []
        });

        // Refresh dashboard in original message
        const updated = await renderDashboard({ tab: 'suggestions', guildId: i.guild.id });

        // Try to update the dashboard message (may need to find it)
        if (i.message && 'edit' in i.message) {
            await i.message.edit(updated).catch(() => {
                logger.debug('Could not update dashboard message');
            });
        }
    } catch (err) {
        logger.error({ error: err }, 'Error saving suggestions channel');
        await handleError(i, err);
    }
});
