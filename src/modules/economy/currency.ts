// src/modules/economy/currency.ts
import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    type ButtonInteraction,
    type ModalSubmitInteraction,
    MessageFlags,
} from 'discord.js';
import { zkSettings } from '../../services/zk/settings.js';

export async function openCurrencyModal(interaction: ButtonInteraction) {
    const guildId = interaction.guildId!;

    const currentName = await zkSettings.getCurrencyName(guildId);
    const currentSymbol = await zkSettings.getCurrencySymbol(guildId);

    const modal = new ModalBuilder()
        .setCustomId('economy:currency:modal')
        .setTitle('Configurar Moeda');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Nome da Moeda')
                .setPlaceholder('Ex: NoWay Points, Zenkae')
                .setValue(currentName)
                .setStyle(TextInputStyle.Short)
                .setMaxLength(30)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('symbol')
                .setLabel('Símbolo (Abreviação)')
                .setPlaceholder('Ex: NW, ZK')
                .setValue(currentSymbol)
                .setStyle(TextInputStyle.Short)
                .setMaxLength(10)
                .setRequired(true)
        ),
    );

    await interaction.showModal(modal);
}

export async function handleCurrencySubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.fields.getTextInputValue('name').trim();
    const symbol = interaction.fields.getTextInputValue('symbol').trim();

    await zkSettings.updateCurrency(interaction.guildId!, name, symbol);

    await interaction.editReply(
        `✅ Moeda atualizada!\n\n` +
        `**Nome:** ${name}\n` +
        `**Símbolo:** ${symbol}\n\n` +
        `**Preview:** Você tem **100 ${symbol}**`
    );
}
