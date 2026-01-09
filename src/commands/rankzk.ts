import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} from 'discord.js';
import { zkStore } from '../services/zk/store.js';
import { zkSettings } from '../services/zk/settings.js';
import { Brand, getBuilders } from '../ui/v2.js';
import { EMOJI } from '../ui/icons.generated.js';

export const data = new SlashCommandBuilder()
    .setName('rankzk')
    .setDescription('Mostra o ranking de saldo da moeda do servidor');

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = getBuilders();

    if (!ContainerBuilder || !TextDisplayBuilder) {
        await interaction.reply({ content: '❌ Este bot não suporta Components V2.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();
    const guildId = interaction.guildId;

    // Get currency name
    const currencyName = await zkSettings.getCurrencyName(guildId);
    const currencySymbol = await zkSettings.getCurrencySymbol(guildId);

    let currentPage = 1;
    const ITEMS_PER_PAGE = 7;

    const generatePayload = async (page: number) => {
        const topUsers = await zkStore.getTopZK(guildId, 999);
        const totalPages = Math.max(1, Math.ceil(topUsers.length / ITEMS_PER_PAGE));
        const start = (page - 1) * ITEMS_PER_PAGE;
        const pageUsers = topUsers.slice(start, start + ITEMS_PER_PAGE);

        // Build Container
        const container = new ContainerBuilder().setBranding(Brand.purple);

        // Header
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${interaction.guild.name}\n🏆 ${currencyName} Leaderboard • Página ${page}`
            )
        );

        // Users list
        for (const user of pageUsers) {
            const rank = topUsers.indexOf(user) + 1;
            const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
            const username = member?.displayName || member?.user.username || 'Usuário';

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**${medal}** — **${user.balance.toLocaleString()} ${currencySymbol}** ${username}`
                )
            );
        }

        // Navigation Buttons
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Próximo')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages)
            );

        return {
            components: [container, row]
        };
    };

    try {
        const initialPayload = await generatePayload(currentPage);
        const message = await interaction.editReply(initialPayload);

        const collector = message.createMessageComponentCollector({
            time: 60000
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: '❌ Você não pode controlar este painel.', flags: 64 });
                return;
            }

            if (i.componentType === ComponentType.Button) {
                if (i.customId === 'next') {
                    currentPage++;
                } else if (i.customId === 'prev') {
                    currentPage--;
                }

                const newPayload = await generatePayload(currentPage);
                await i.update(newPayload);
            }
        });
    } catch (err) {
        console.error('[RANKZK] Error:', err);
        try { await interaction.editReply('❌ Erro ao renderizar ranking.'); } catch { }
    }
}
