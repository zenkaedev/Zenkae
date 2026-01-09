import { CommandInteraction, MessageFlags, InteractionReplyOptions } from 'discord.js';

/**
 * Sends a temporary reply that auto-deletes after a timeout (default 10s).
 * Safely handles ephemeral messages by attempting deleteReply().
 */
export async function replyTemporary(
    interaction: CommandInteraction | any,
    content: string | InteractionReplyOptions,
    seconds = 10
) {
    try {
        const payload = typeof content === 'string' ? { content } : content;

        // Check if we need to edit (already replied/deferred) or reply
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply({
                ...payload,
                flags: MessageFlags.Ephemeral // Default to ephemeral if not specified, or keep existing behavior
            });
        }

        // Schedule deletion
        setTimeout(async () => {
            try {
                await interaction.deleteReply().catch(() => { });
            } catch (err) {
                // Ignore delete errors (e.g. strict ephemeral limits or already deleted)
            }
        }, seconds * 1000);

    } catch (err) {
        console.error('Failed to send temporary reply:', err);
    }
}
