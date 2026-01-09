// src/commands/bid.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { auctionInventory } from '../services/auction/inventory.js';
import { bidManager } from '../services/auction/bid-manager.js';
import { zkSettings } from '../services/zk/settings.js';

export const data = new SlashCommandBuilder()
    .setName('bid')
    .setDescription('Sistema de leilão')
    .addSubcommand(sub =>
        sub
            .setName('iniciar')
            .setDescription('[ADMIN] Iniciar leilão de um item')
            .addStringOption(opt => opt.setName('item_id').setDescription('ID do item').setRequired(true))
    )
    .addSubcommand(sub =>
        sub
            .setName('encerrar')
            .setDescription('[ADMIN] Encerrar leilão e determinar vencedor')
            .addStringOption(opt => opt.setName('item_id').setDescription('ID do item').setRequired(true))
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
        await interaction.reply({ content: '❌ Este comando só funciona em servidores.', flags: 64 });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'iniciar') {
        // Admin only
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Apenas administradores podem iniciar leilões.', flags: 64 });
            return;
        }

        const itemId = interaction.options.getString('item_id', true);

        await interaction.deferReply();

        try {
            const item = await auctionInventory.getItem(itemId);
            if (!item) {
                await interaction.editReply('❌ Item não encontrado.');
                return;
            }

            const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId);

            const embed = new EmbedBuilder()
                .setTitle(`🎁 ${item.name}`)
                .setDescription(item.description)
                .setImage(item.imageUrl)
                .setColor(0x6d28d9)
                .addFields(
                    { name: '💰 Preço', value: `${item.zkCost} ${currencySymbol}`, inline: true }
                )
                .setFooter({ text: 'Clique abaixo para participar!' });

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`auction_bid_${item.id}`)
                        .setLabel('🤚 EU QUERO')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (err: any) {
            await interaction.editReply(`❌ Erro: ${err.message}`);
        }
    }

    else if (subcommand === 'encerrar') {
        // Admin only
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Apenas administradores podem encerrar leilões.', flags: 64 });
            return;
        }

        const itemId = interaction.options.getString('item_id', true);

        await interaction.deferReply();

        try {
            const result = await bidManager.closeAuction(interaction.guildId, itemId);

            if (!result.success) {
                await interaction.editReply(`❌ ${result.message}`);
                return;
            }

            await interaction.editReply(
                `🎉 **Leilão Encerrado!**\n\n${result.message}`
            );
        } catch (err: any) {
            await interaction.editReply(`❌ Erro: ${err.message}`);
        }
    }
}
