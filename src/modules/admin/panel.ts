// src/modules/admin/panel.ts
import {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuInteraction,
    MessageFlags
} from 'discord.js';
import { Context } from '../../infra/context.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * Main Admin Dashboard
 */
export async function renderAdminHome(guildId: string) {
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Painel Administrativo')
        .setDescription(
            `Central de controle do servidor.\n\n` +
            `**Utilitários:**\n` +
            `- **Check-in Semanal:** Ativar/Desativar mensagem automática.\n` +
            `- **Limpeza:** Remover mensagens do bot.\n\n` +
            `**Configurações:**\n` +
            `- **Ranking:** Definir cargos de premiação (Semanal/Mensal).`
        )
        .setColor(0x2b2d31) // Discord Dark/Premium
        .setThumbnail('https://cdn.discordapp.com/emojis/1040263690623254568.webp?size=96&quality=lossless'); // Example 'Shield' or similar if available, or just omit/use banner.

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('admin:config:rank')
            .setLabel('Configurar Ranking')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏆'),
        new ButtonBuilder()
            .setCustomId('recruit:publish') // Reusing existing ID if compatible, or map new one
            .setLabel('Check-in Semanal')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📅'),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('admin:clean')
            .setLabel('Limpar Mensagem')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),

        new ButtonBuilder()
            .setCustomId('dash:home')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('↩️'),
    );

    return { embeds: [embed], components: [row1, row2] };
}

/**
 * Rank Configuration Panel
 */
export async function renderRankConfig(guildId: string) {
    // Get current settings
    const settings = await prisma.rankSettings.findUnique({ where: { guildId } });

    const weeklyRole = settings?.weeklyRoleId ? `<@&${settings.weeklyRoleId}>` : '_Não definido_';
    const monthlyRole = settings?.monthlyRoleId ? `<@&${settings.monthlyRoleId}>` : '_Não definido_';

    const embed = new EmbedBuilder()
        .setTitle('🏆 Configuração de Ranking')
        .setDescription(
            `Defina os cargos que serão entregues automaticamente aos vencedores do Ranking de XP.\n\n` +
            `**Cargo Semanal:** ${weeklyRole}\n` +
            `**Cargo Mensal:** ${monthlyRole}`
        )
        .setColor(0xFFA500);

    const selectWeekly = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('admin:rank:weekly')
            .setPlaceholder('Selecionar Cargo Semanal (Top 1)')
    );

    const selectMonthly = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('admin:rank:monthly')
            .setPlaceholder('Selecionar Cargo Mensal (Top 1)')
    );

    const rowBack = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('admin:home')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [selectWeekly, selectMonthly, rowBack] };
}
