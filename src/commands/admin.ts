// src/commands/admin.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits
} from 'discord.js';
import { zkStore } from '../services/zk/store.js';
import { zkSettings } from '../services/zk/settings.js';

export const data = new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Comandos administrativos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
        group
            .setName('zk')
            .setDescription('Gerenciar moeda do servidor')
            .addSubcommand(sub =>
                sub
                    .setName('add')
                    .setDescription('Adicionar moeda a um usuário')
                    .addUserOption(opt => opt.setName('usuario').setDescription('Usuário').setRequired(true))
                    .addIntegerOption(opt => opt.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1))
                    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo').setRequired(false))
            )
            .addSubcommand(sub =>
                sub
                    .setName('remove')
                    .setDescription('Remover moeda de um usuário')
                    .addUserOption(opt => opt.setName('usuario').setDescription('Usuário').setRequired(true))
                    .addIntegerOption(opt => opt.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1))
                    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo').setRequired(false))
            )
            .addSubcommand(sub =>
                sub
                    .setName('set')
                    .setDescription('Definir saldo exato de um usuário')
                    .addUserOption(opt => opt.setName('usuario').setDescription('Usuário').setRequired(true))
                    .addIntegerOption(opt => opt.setName('quantidade').setDescription('Novo saldo').setRequired(true).setMinValue(0))
            )
            .addSubcommand(sub =>
                sub
                    .setName('balance')
                    .setDescription('Ver saldo de um usuário')
                    .addUserOption(opt => opt.setName('usuario').setDescription('Usuário').setRequired(true))
            )
    )
    .addSubcommandGroup(group =>
        group
            .setName('item')
            .setDescription('Gerenciar items do leilão')
            .addSubcommand(sub =>
                sub
                    .setName('cadastrar')
                    .setDescription('Adicionar item ao inventário')
                    .addStringOption(opt => opt.setName('nome').setDescription('Nome do item').setRequired(true))
                    .addStringOption(opt => opt.setName('descricao').setDescription('Descrição').setRequired(true))
                    .addStringOption(opt => opt.setName('imagem').setDescription('URL da imagem').setRequired(true))
                    .addIntegerOption(opt => opt.setName('preco').setDescription('Preço em ZK').setRequired(true).setMinValue(1))
            )
            .addSubcommand(sub =>
                sub.setName('listar').setDescription('Ver todos os items cadastrados')
            )
            .addSubcommand(sub =>
                sub
                    .setName('remover')
                    .setDescription('Remover item do inventário')
                    .addStringOption(opt => opt.setName('id').setDescription('ID do item').setRequired(true))
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
        await interaction.reply({ content: '❌ Este comando só funciona em servidores.', flags: 64 });
        return;
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === 'zk') {
        const currencyName = await zkSettings.getCurrencyName(interaction.guildId);
        const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId);

        if (subcommand === 'add') {
            const user = interaction.options.getUser('usuario', true);
            const amount = interaction.options.getInteger('quantidade', true);
            const reason = interaction.options.getString('motivo') || 'Admin: Adicionado manualmente';

            await interaction.deferReply({ flags: 64 });

            try {
                const newBalance = await zkStore.addZK(
                    interaction.guildId,
                    user.id,
                    amount,
                    reason
                );

                await interaction.editReply(
                    `✅ Adicionado **${amount} ${currencySymbol}** para ${user}\n` +
                    `Novo saldo: **${newBalance.toLocaleString()} ${currencySymbol}**`
                );
            } catch (err: any) {
                await interaction.editReply(`❌ Erro: ${err.message}`);
            }
        }

        else if (subcommand === 'remove') {
            const user = interaction.options.getUser('usuario', true);
            const amount = interaction.options.getInteger('quantidade', true);
            const reason = interaction.options.getString('motivo') || 'Admin: Removido manualmente';

            await interaction.deferReply({ flags: 64 });

            try {
                const newBalance = await zkStore.removeZK(
                    interaction.guildId,
                    user.id,
                    amount,
                    reason
                );

                await interaction.editReply(
                    `✅ Removido **${amount} ${currencySymbol}** de ${user}\n` +
                    `Novo saldo: **${newBalance.toLocaleString()} ${currencySymbol}**`
                );
            } catch (err: any) {
                await interaction.editReply(`❌ Erro: ${err.message}`);
            }
        }

        else if (subcommand === 'set') {
            const user = interaction.options.getUser('usuario', true);
            const amount = interaction.options.getInteger('quantidade', true);

            await interaction.deferReply({ flags: 64 });

            try {
                await zkStore.setBalance(interaction.guildId, user.id, amount);

                await interaction.editReply(
                    `✅ Saldo de ${user} definido para **${amount.toLocaleString()} ${currencySymbol}**`
                );
            } catch (err: any) {
                await interaction.editReply(`❌ Erro: ${err.message}`);
            }
        }

        else if (subcommand === 'balance') {
            const user = interaction.options.getUser('usuario', true);

            await interaction.deferReply({ flags: 64 });

            try {
                const balance = await zkStore.getBalance(interaction.guildId, user.id);

                await interaction.editReply(
                    `💰 Saldo de ${user}: **${balance.toLocaleString()} ${currencySymbol}**`
                );
            } catch (err: any) {
                await interaction.editReply(`❌ Erro: ${err.message}`);
            }
        }
    }

    else if (group === 'item') {
        const { auctionInventory } = await import('../services/auction/inventory.js');

        if (subcommand === 'cadastrar') {
            const nome = interaction.options.getString('nome', true);
            const descricao = interaction.options.getString('descricao', true);
            const imagem = interaction.options.getString('imagem', true);
            const preco = interaction.options.getInteger('preco', true);

            await interaction.deferReply({ flags: 64 });

            try {
                const item = await auctionInventory.createItem(
                    interaction.guildId,
                    nome,
                    descricao,
                    imagem,
                    preco
                );

                const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId);
                await interaction.editReply(
                    `✅ Item cadastrado com sucesso!\n\n` +
                    `**${nome}**\n` +
                    `💰 Preço: ${preco} ${currencySymbol}\n` +
                    `🆔 ID: \`${item.id}\``
                );
            } catch (err: any) {
                await interaction.editReply(`❌ Erro: ${err.message}`);
            }
        }

        else if (subcommand === 'listar') {
            await interaction.deferReply({ flags: 64 });

            try {
                const items = await auctionInventory.getItems(interaction.guildId);

                if (items.length === 0) {
                    await interaction.editReply('📭 Nenhum item cadastrado.');
                    return;
                }

                const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId);
                const list = items.map((item: any) =>
                    `**${item.name}** - ${item.zkCost} ${currencySymbol}\n` +
                    `ID: \`${item.id}\``
                ).join('\n\n');

                await interaction.editReply(`**Items Cadastrados (${items.length})**\n\n${list}`);
            } catch (err: any) {
                await interaction.editReply(`❌ Erro: ${err.message}`);
            }
        }

        else if (subcommand === 'remover') {
            const id = interaction.options.getString('id', true);

            await interaction.deferReply({ flags: 64 });

            try {
                await auctionInventory.deleteItem(id);
                await interaction.editReply('✅ Item removido com sucesso!');
            } catch (err: any) {
                await interaction.editReply(`❌ Erro: ${err.message}`);
            }
        }
    }
}
