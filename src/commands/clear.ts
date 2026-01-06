// src/commands/clear.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa mensagens do canal (Admin)')
    .addIntegerOption(option =>
        option
            .setName('quantidade')
            .setDescription('Número de mensagens para deletar (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
        await interaction.reply({
            content: '❌ Este comando só funciona em servidores.',
            flags: 64
        });
        return;
    }

    // Verificar permissão
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({
            content: '❌ Você precisa de permissão de **Gerenciar Mensagens**.',
            flags: 64,
        });
        return;
    }

    await interaction.deferReply({ flags: 64 }); // Ephemeral

    const amount = interaction.options.getInteger('quantidade', true);
    const channel = interaction.channel;

    if (!channel || !(channel instanceof TextChannel)) {
        await interaction.editReply('❌ Comando só funciona em canais de texto.');
        return;
    }

    try {
        // bulkDelete só funciona com mensagens de até 14 dias
        const deleted = await channel.bulkDelete(amount, true);

        await interaction.editReply(
            `🗑️ **Limpeza concluída**: ${deleted.size} mensagens removidas.`
        );

        // Auto-delete após 5 segundos
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch {
                // Ignore se já foi deletado
            }
        }, 5000);
    } catch (err: any) {
        console.error('Error clearing messages:', err);

        let errorMsg = '❌ Erro ao deletar mensagens.';

        if (err.code === 50034) {
            errorMsg = '❌ Não é possível deletar mensagens com mais de 14 dias.';
        } else if (err.code === 50013) {
            errorMsg = '❌ O bot não tem permissão para deletar mensagens neste canal.';
        }

        await interaction.editReply(errorMsg);
    }
}
