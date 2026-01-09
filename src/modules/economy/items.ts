// src/modules/economy/items.ts
import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ButtonInteraction,
    type ModalSubmitInteraction,
    MessageFlags,
} from 'discord.js';
import { auctionInventory } from '../../services/auction/inventory.js';
import { bidManager } from '../../services/auction/bid-manager.js';
import { zkSettings } from '../../services/zk/settings.js';

export async function openNewItemModal(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('economy:items:new:modal')
        .setTitle('Cadastrar Novo Item');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Nome do Item')
                .setPlaceholder('Ex: Espada Lendária')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Descrição')
                .setPlaceholder('Descrição do item')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('image')
                .setLabel('URL da Imagem')
                .setPlaceholder('https://...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('price')
                .setLabel('Preço em ZK')
                .setPlaceholder('Ex: 500')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
    );

    await interaction.showModal(modal);
}

export async function handleNewItemSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.fields.getTextInputValue('name').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const imageUrl = interaction.fields.getTextInputValue('image').trim();
    const priceStr = interaction.fields.getTextInputValue('price').trim();

    const price = parseInt(priceStr);
    if (isNaN(price) || price < 1) {
        await interaction.editReply('❌ Preço inválido. Digite um número maior que 0.');
        return;
    }

    const item = await auctionInventory.createItem(
        interaction.guildId!,
        name,
        description,
        imageUrl,
        price
    );

    const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId!);

    await interaction.editReply(
        `✅ Item cadastrado!\n\n` +
        `**${name}**\n` +
        `💰 ${price} ${currencySymbol}\n` +
        `🆔 \`${item.id}\``
    );
}

export async function renderItemDetails(interaction: ButtonInteraction, itemId: string) {
    const item = await auctionInventory.getItem(itemId);

    if (!item) {
        await interaction.reply({ content: '❌ Item não encontrado.', flags: 64 });
        return;
    }

    const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId!);

    const embed = new EmbedBuilder()
        .setTitle(item.name)
        .setDescription(item.description)
        .setImage(item.imageUrl)
        .setColor(0x6d28d9)
        .addFields({ name: '💰 Preço', value: `${item.zkCost} ${currencySymbol}`, inline: true });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`economy:item:${itemId}:auction`)
            .setLabel('Iniciar Leilão')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚀'),
        new ButtonBuilder()
            .setCustomId(`economy:item:${itemId}:delete`)
            .setLabel('Deletar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder()
            .setCustomId('economy:items')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}

export async function handleStartAuctionFromPanel(interaction: ButtonInteraction, itemId: string) {
    await interaction.deferReply();

    const item = await auctionInventory.getItem(itemId);
    if (!item) {
        await interaction.editReply('❌ Item não encontrado.');
        return;
    }

    const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId!);

    // Post auction in current channel
    const embed = new EmbedBuilder()
        .setTitle(`🎁 ${item.name}`)
        .setDescription(item.description)
        .setImage(item.imageUrl)
        .setColor(0x6d28d9)
        .addFields({ name: '💰 Preço', value: `${item.zkCost} ${currencySymbol}`, inline: true })
        .setFooter({ text: 'Clique abaixo para participar!' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`auction_bid_${item.id}`)
            .setLabel('🤚 EU QUERO')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleDeleteItem(interaction: ButtonInteraction, itemId: string) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await auctionInventory.deleteItem(itemId);

    await interaction.editReply('✅ Item deletado com sucesso!');
}
