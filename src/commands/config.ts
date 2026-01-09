// src/commands/config.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalSubmitInteraction
} from 'discord.js';
import { zkSettings } from '../services/zk/settings.js';

export const data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurações do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub
            .setName('currency')
            .setDescription('Configurar nome da moeda do servidor')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
        await interaction.reply({ content: '❌ Este comando só funciona em servidores.', flags: 64 });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'currency') {
        // Get current settings
        const currentName = await zkSettings.getCurrencyName(interaction.guildId);
        const currentSymbol = await zkSettings.getCurrencySymbol(interaction.guildId);

        // Show modal
        const modal = new ModalBuilder()
            .setCustomId('config_currency_modal')
            .setTitle('Configurar Moeda do Servidor');

        const nameInput = new TextInputBuilder()
            .setCustomId('currency_name')
            .setLabel('Nome da Moeda')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: NoWay Points, Zenkae, Moedas')
            .setValue(currentName)
            .setMaxLength(30)
            .setRequired(true);

        const symbolInput = new TextInputBuilder()
            .setCustomId('currency_symbol')
            .setLabel('Símbolo da Moeda (Abreviação)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: NW, ZK, M')
            .setValue(currentSymbol)
            .setMaxLength(10)
            .setRequired(true);

        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
        const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(symbolInput);

        modal.addComponents(row1, row2);

        await interaction.showModal(modal);

        // Handle modal submission
        try {
            const submission = await interaction.awaitModalSubmit({
                time: 120000,
                filter: (i) => i.customId === 'config_currency_modal' && i.user.id === interaction.user.id
            }) as ModalSubmitInteraction;

            const newName = submission.fields.getTextInputValue('currency_name');
            const newSymbol = submission.fields.getTextInputValue('currency_symbol');

            // Update settings
            await zkSettings.updateCurrency(interaction.guildId, newName, newSymbol);

            await submission.reply({
                content: `✅ Moeda configurada com sucesso!\n\n**Nome:** ${newName}\n**Símbolo:** ${newSymbol}\n\nTodos os comandos e exibições agora usarão esse nome.`,
                flags: 64
            });
        } catch (err) {
            // Modal timeout or error - do nothing
            console.error('[CONFIG] Modal error:', err);
        }
    }
}
