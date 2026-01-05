import {
    EmbedBuilder,
    MessageFlags,
    type RepliableInteraction
} from 'discord.js';
import { logger } from './logger.js';

export class AppError extends Error {
    constructor(
        public message: string,
        public code: string = 'UNKNOWN',
        public userMessage?: string
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export async function handleError(interaction: RepliableInteraction, err: unknown) {
    const errorId = Math.random().toString(36).substring(7).toUpperCase();

    // 1. Log structured
    logger.error({ err, errorId, user: interaction.user.tag }, 'Interaction Error');

    // 2. Determine user message
    let userMsg = 'Ocorreu um erro interno. Tente novamente mais tarde.';
    if (err instanceof AppError && err.userMessage) {
        userMsg = err.userMessage;
    }

    const embed = new EmbedBuilder()
        .setColor(0xff5555) // Red
        .setTitle('❌ Ocorreu um erro')
        .setDescription(userMsg)
        .setFooter({ text: `Ref: ${errorId}` });

    // 3. Safe Reply
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.followUp({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch (replyErr) {
        logger.error({ replyErr }, 'Failed to send error reply to user');
    }
}
