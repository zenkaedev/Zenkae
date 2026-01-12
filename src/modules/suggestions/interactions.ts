// src/modules/suggestions/interactions.ts
import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionFlagsBits,
    type ButtonInteraction,
    type ModalSubmitInteraction
} from 'discord.js';
import { InteractionRouter } from '../../infra/router.js';
import { suggestionStore } from './store.js';
import { buildSuggestionCard } from './card.js';
import { handleError } from '../../infra/errors.js';
import { logger } from '../../infra/logger.js';

export const suggestionRouter = new InteractionRouter();

// Fix #8: Rate limiting (1 min cooldown)
const suggestionCooldowns = new Map<string, number>();
const SUGGESTION_COOLDOWN_MS = 60000; // 1 minute

// Helper to get display name with type guard
function getDisplayName(member: unknown, fallback: string): string {
    if (member && typeof member === 'object' && member !== null && 'displayName' in member) {
        return (member as { displayName: string }).displayName;
    }
    return fallback;
}

// Fix #2: Input sanitization helper
function sanitizeInput(input: string, maxLength: number): string {
    return input
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
        .slice(0, maxLength);
}

/* ----------------------------- NEW SUGGESTION ----------------------------- */

suggestionRouter.button('suggestion:new', async (i) => {
    const modal = new ModalBuilder()
        .setCustomId('suggestion:submit')
        .setTitle('Nova Sugestão');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Título')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true)
                .setPlaceholder('Ex: Adicionar canal de música')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Descrição')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(2000)
                .setRequired(true)
                .setPlaceholder('Descreva sua sugestão em detalhes...')
        )
    );

    await i.showModal(modal);
});

/* ----------------------------- SUBMIT SUGGESTION ----------------------------- */

suggestionRouter.modal('suggestion:submit', async (i: ModalSubmitInteraction) => {
    await i.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        if (!i.guild) {
            await i.editReply('❌ Este comando só funciona em servidores.');
            return;
        }

        // Fix #8: Rate limiting check
        const userId = i.user.id;
        const now = Date.now();
        const cooldown = suggestionCooldowns.get(userId);

        if (cooldown && now - cooldown < SUGGESTION_COOLDOWN_MS) {
            const remaining = Math.ceil((SUGGESTION_COOLDOWN_MS - (now - cooldown)) / 1000);
            await i.editReply(`❌ Aguarde ${remaining} segundos antes de enviar outra sugestão.`);
            return;
        }

        // Fix #2: Sanitize input
        const title = sanitizeInput(i.fields.getTextInputValue('title'), 100);
        const description = sanitizeInput(i.fields.getTextInputValue('description'), 2000);

        // Fix #2: Validate minimum lengths
        if (title.length < 3) {
            await i.editReply('❌ Título muito curto (mínimo 3 caracteres).');
            return;
        }

        if (description.length < 10) {
            await i.editReply('❌ Descrição muito curta (mínimo 10 caracteres).');
            return;
        }

        // Get settings
        const settings = await suggestionStore.getSettings(i.guild.id);

        if (!settings.suggestionsChannelId) {
            await i.editReply('❌ Canal de sugestões não configurado. Contate um administrador.');
            return;
        }

        // Fetch channel
        const channel = await i.guild.channels.fetch(settings.suggestionsChannelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            await i.editReply('❌ Canal de sugestões não encontrado.');
            return;
        }

        // HOTFIX: Create in DB FIRST to get real ID
        const savedSuggestion = await suggestionStore.create({
            guildId: i.guild.id,
            userId: i.user.id,
            userDisplay: getDisplayName(i.member, i.user.displayName),
            title,
            description,
            channelId: settings.suggestionsChannelId,
            messageId: 'pending' // Temporary, will update
        });

        // Now build card with REAL ID (no more 'temp'!)
        const card = buildSuggestionCard({
            suggestion: savedSuggestion,
            agreeCount: 0,
            disagreeCount: 0
        });

        // Send to channel
        const message = await channel.send(card);

        // Create thread automatically using Discord's native feature
        let threadId: string | null = null;
        try {
            // Check if bot has permission to create threads
            if ('permissionsFor' in channel) {
                const botMember = await i.guild.members.fetchMe().catch(() => null);
                if (botMember) {
                    const permissions = channel.permissionsFor(botMember);
                    if (permissions?.has(PermissionFlagsBits.CreatePublicThreads)) {
                        const thread = await message.startThread({
                            name: `💬 ${title.slice(0, 90)}`,
                            autoArchiveDuration: 1440 // 24 hours
                        });
                        threadId = thread.id;

                        logger.info({
                            guildId: i.guild.id,
                            suggestionId: savedSuggestion.id,
                            threadId: thread.id
                        }, 'Thread created automatically');
                    }
                }
            }
        } catch (err) {
            // Thread creation failed, but suggestion is still valid
            logger.warn({ error: err, messageId: message.id }, 'Could not create thread');
        }

        // Update with real messageId and threadId (if created)
        await suggestionStore.update(savedSuggestion.id, {
            messageId: message.id,
            ...(threadId && { threadId })
        });

        // Fix #8: Set cooldown
        suggestionCooldowns.set(userId, Date.now());

        logger.info({
            guildId: i.guild.id,
            userId: i.user.id,
            suggestionId: savedSuggestion.id,
            messageId: message.id,
            title
        }, 'Suggestion created');

        await i.editReply(`✅ Sua sugestão foi enviada com sucesso! ${message.url}`);
    } catch (err) {
        logger.error({ error: err, userId: i.user.id }, 'Error submitting suggestion');
        await handleError(i, err);
    }
});

/* ----------------------------- VOTING ----------------------------- */

suggestionRouter.button(/^suggestion:vote:(agree|disagree):(.+)$/, async (i: ButtonInteraction) => {
    await i.deferUpdate();

    try {
        const match = i.customId.match(/^suggestion:vote:(agree|disagree):(.+)$/);
        if (!match) return;

        const [, voteType, suggestionId] = match;

        // Fix #3: Vote now returns counts atomically (no race condition)
        const counts = await suggestionStore.vote(suggestionId, i.user.id, voteType as 'agree' | 'disagree');

        // Get suggestion
        const suggestion = await suggestionStore.get(suggestionId);
        if (!suggestion) {
            logger.error({ suggestionId }, 'Suggestion not found for vote');
            // Fix #7: User feedback
            await i.followUp({
                content: '❌ Sugestão não encontrada.',
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
            return;
        }

        // Re-render card with updated counts
        const updated = buildSuggestionCard({
            suggestion,
            agreeCount: counts.agree,
            disagreeCount: counts.disagree
        });

        await i.editReply(updated);

        logger.debug({
            suggestionId,
            userId: i.user.id,
            voteType,
            counts
        }, 'Vote registered');
    } catch (err) {
        logger.error({ error: err, customId: i.customId }, 'Error voting on suggestion');
        // Fix #7: User feedback on error
        await i.followUp({
            content: '❌ Erro ao registrar voto. Tente novamente.',
            flags: MessageFlags.Ephemeral
        }).catch(() => { });
    }
});
