// src/modules/economy/panel.ts
import {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';
import { Context } from '../../infra/context.js';
import { zkSettings } from '../../services/zk/settings.js';
import { auctionInventory } from '../../services/auction/inventory.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * Painel Principal de Economia
 */
export async function renderEconomyHome(guildId: string) {
    // Get current settings
    const currencyName = await zkSettings.getCurrencyName(guildId);
    const currencySymbol = await zkSettings.getCurrencySymbol(guildId);

    // Count items
    const items = await auctionInventory.getItems(guildId);
    const itemCount = items.length;

    // Count upcoming events
    const events = await prisma.zKEvent.findMany({
        where: { guildId, completed: false },
    });
    const eventCount = events.length;

    // Get top holder
    const topHolders = await prisma.userZK.findMany({
        where: { guildId },
        orderBy: { balance: 'desc' },
        take: 1,
    });
    const topHolder = topHolders[0];

    const embed = new EmbedBuilder()
        .setTitle('💰 Painel de Economia ZK')
        .setDescription(
            `Gerencie a economia do servidor de forma visual.\n\n` +
            `**Moeda Atual:** ${currencyName} (${currencySymbol})\n` +
            `**Items Cadastrados:** ${itemCount}\n` +
            `**Eventos Agendados:** ${eventCount}\n` +
            `**Top Holder:** ${topHolder ? `<@${topHolder.userId}> (${topHolder.balance} ${currencySymbol})` : 'Nenhum'}`
        )
        .setColor(0x6d28d9);

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('economy:currency')
            .setLabel('Moeda')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💰'),
        new ButtonBuilder()
            .setCustomId('economy:items')
            .setLabel('Items')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎁'),
        new ButtonBuilder()
            .setCustomId('economy:events')
            .setLabel('Eventos')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📅'),
        new ButtonBuilder()
            .setCustomId('economy:stats')
            .setLabel('Estatísticas')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📈'),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('dash:home')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('↩️'),
    );

    return { embeds: [embed], components: [row1, row2] };
}

/**
 * Lista de Items
 */
export async function renderItemsList(guildId: string) {
    const items = await auctionInventory.getItems(guildId);
    const currencySymbol = await zkSettings.getCurrencySymbol(guildId);

    let description = '';
    if (items.length === 0) {
        description = '_Nenhum item cadastrado ainda._\n\nClique em **Novo Item** para adicionar.';
    } else {
        const lines = items.map((item: any, idx: number) =>
            `**${idx + 1}. ${item.name}** - ${item.zkCost} ${currencySymbol}\n` +
            `└ ID: \`${item.id}\``
        );
        description = lines.join('\n\n');
    }

    const embed = new EmbedBuilder()
        .setTitle('🎁 Gerenciar Items de Leilão')
        .setDescription(description)
        .setColor(0x6d28d9)
        .setFooter({ text: 'Clique em um item para editar/leiloar' });

    const buttons: ButtonBuilder[] = [];

    // Add item buttons (max 3 per row)
    items.slice(0, 9).forEach((item: any, idx: number) => {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`economy:item:${item.id}`)
                .setLabel(`${idx + 1}. ${item.name.slice(0, 20)}`)
                .setStyle(ButtonStyle.Secondary)
        );
    });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Split buttons into rows of 3
    for (let i = 0; i < buttons.length; i += 3) {
        rows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                buttons.slice(i, i + 3)
            )
        );
    }

    // Control row
    const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('economy:items:new')
            .setLabel('Novo Item')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('economy:home')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Primary),
    );

    rows.push(controlRow);

    return { embeds: [embed], components: rows };
}

/**
 * Lista de Eventos
 */
export async function renderEventsList(guildId: string) {
    const events = await prisma.zKEvent.findMany({
        where: { guildId, completed: false },
        orderBy: { eventDate: 'asc' },
        include: { rsvps: true },
    });

    const currencySymbol = await zkSettings.getCurrencySymbol(guildId);

    let description = '';
    if (events.length === 0) {
        description = '_Nenhum evento agendado._\n\nClique em **Novo Evento** para criar.';
    } else {
        const lines = events.map((event: any, idx: number) => {
            const date = new Date(event.eventDate).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
            });
            const yesCount = event.rsvps.filter((r: any) => r.response === 'YES').length;
            const noCount = event.rsvps.filter((r: any) => r.response === 'NO').length;

            return `**${idx + 1}. ${event.title}**\n` +
                `└ ${date} · 💰${event.zkReward} ${currencySymbol} · ✅${yesCount} ❌${noCount}`;
        });
        description = lines.join('\n\n');
    }

    const embed = new EmbedBuilder()
        .setTitle('📅 Gerenciar Eventos')
        .setDescription(description)
        .setColor(0x6d28d9);

    const buttons: ButtonBuilder[] = [];

    events.slice(0, 9).forEach((event: any, idx: number) => {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`economy:event:${event.id}`)
                .setLabel(`${idx + 1}. ${event.title.slice(0, 20)}`)
                .setStyle(ButtonStyle.Secondary)
        );
    });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 3) {
        rows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                buttons.slice(i, i + 3)
            )
        );
    }

    const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('economy:events:new')
            .setLabel('Novo Evento')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('economy:home')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Primary),
    );

    rows.push(controlRow);

    return { embeds: [embed], components: rows };
}

/**
 * Estatísticas
 */
export async function renderStats(guildId: string) {
    const currencySymbol = await zkSettings.getCurrencySymbol(guildId);

    // Total ZK in circulation
    const allBalances = await prisma.userZK.findMany({
        where: { guildId },
    });
    const totalZK = allBalances.reduce((sum: number, u: any) => sum + u.balance, 0);

    // Transactions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const txCount = await prisma.zkTransaction.count({
        where: {
            guildId,
            createdAt: { gte: today },
        },
    });

    // Top 3 holders
    const topHolders = await prisma.userZK.findMany({
        where: { guildId },
        orderBy: { balance: 'desc' },
        take: 3,
    });

    const medals = ['🥇', '🥈', '🥉'];
    const topList = topHolders.length > 0
        ? topHolders.map((h: any, i: number) =>
            `${medals[i]} <@${h.userId}> - ${h.balance} ${currencySymbol}`
        ).join('\n')
        : '_Nenhum holder ainda_';

    const embed = new EmbedBuilder()
        .setTitle('📈 Estatísticas da Economia')
        .setDescription(
            `**Total em Circulação:** ${totalZK.toLocaleString()} ${currencySymbol}\n` +
            `**Transações Hoje:** ${txCount}\n\n` +
            `**Top 3 Holders:**\n${topList}`
        )
        .setColor(0x6d28d9);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('economy:home')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Primary),
    );

    return { embeds: [embed], components: [row] };
}
