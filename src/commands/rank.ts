import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { xpStore } from '../services/xp/store.js';
// Import V2 internal helpers
import { Brand } from '../ui/v2.js';

// Accessing internal V2 builders via reflection since they are not in standard typings
const dAny = await import('discord.js') as any;

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Mostra o ranking de níveis do servidor (V2)');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) return;

  // Check V2 Support
  const ContainerBuilder = dAny.ContainerBuilder;
  const TextDisplayBuilder = dAny.TextDisplayBuilder;
  const SeparatorBuilder = dAny.SeparatorBuilder;

  if (!ContainerBuilder || !TextDisplayBuilder) {
    await interaction.reply({ content: '❌ Este bot não suporta Components V2 (Container/TextDisplay). Verifique a versão da biblioteca.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();
  const guildId = interaction.guildId;

  // State
  let currentPage = 1;
  const ITEMS_PER_PAGE = 7;

  // Helper para gerar o payload (Components V2)
  const generatePayload = async (page: number) => {

    const allTopUsers = await xpStore.getTopUsers(guildId, 50);
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const pageUsers = allTopUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const activeUsers = await Promise.all(pageUsers.map(async (userData: any, index: number) => {
      let displayName = 'Usuário Desconhecido';

      try {
        const member = await interaction.guild.members.fetch(userData.userId).catch(() => null);
        if (member) displayName = member.displayName;
      } catch (e) {
        // ignore
      }

      const { xpProgress } = await xpStore.getUserLevel(guildId, userData.userId);

      return {
        rank: startIndex + index + 1,
        username: displayName,
        level: userData.level,
        xpProgress: xpProgress
      };
    }));

    if (activeUsers.length === 0 && page > 1) {
      return null;
    }

    // --- Build V2 Container ---
    const container = new ContainerBuilder().setAccentColor(Brand.purple);

    // Header
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 🏆 Leaderboard\n**${interaction.guild.name}** • Página ${page}`)
    );

    // Separator
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // List
    for (const user of activeUsers) {
      const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`;
      const progressBar = createTextProgressBar(user.xpProgress);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${medal}  ${user.username}\n**Lvl ${user.level}** • ${progressBar} ${Math.floor(user.xpProgress)}%`)
      );
    }

    if (activeUsers.length === 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`*Nenhum usuário encontrado.*`)
      );
    }

    // Controls (Filter & Nav)
    const filterRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rank_filter')
          .setPlaceholder('Filtrar Ranking')
          .addOptions([
            { label: '🏆 Global (Todo o tempo)', value: 'global', default: true },
            { label: '📅 Mensal (Em breve)', value: 'monthly', description: 'XP ganho neste mês' },
            { label: ' weekly (Em breve)', value: 'weekly', description: 'XP ganho nesta semana' }
          ])
      );

    const navRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Próximo')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageUsers.length < ITEMS_PER_PAGE),
        new ButtonBuilder()
          .setLabel('Ver Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com')
      );

    // Add rows to container
    container.addActionRowComponents(filterRow, navRow);

    // IsComponentsV2 flag = 128 (usually)
    // Checking internal flags definition if possible or hardcoding
    const FLAGS_V2 = (MessageFlags as any).IsComponentsV2 || 128; // Fallback 128 if not in typings

    return { components: [container], flags: FLAGS_V2 };
  };

  try {
    // 1. Enviar primeira página
    const initialPayload = await generatePayload(currentPage);
    if (!initialPayload) {
      await interaction.editReply('Sem dados de ranking.');
      return;
    }

    const message = await interaction.editReply(initialPayload);

    // 2. Collector
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '❌ Você não pode controlar este painel.', flags: 64 });
        return;
      }

      // V2 Defer Update is tricky? try generic defer
      await i.deferUpdate();

      if (i.customId === 'prev') {
        currentPage = Math.max(1, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage++;
      }

      const newPayload = await generatePayload(currentPage);
      if (newPayload) {
        await i.editReply(newPayload);
      } else {
        currentPage--;
      }
    });
  } catch (err) {
    console.error('[RANK] V2 Error:', err);
    try { await interaction.editReply('❌ Erro ao renderizar ranking V2.'); } catch { }
  }
}

function createTextProgressBar(percentage: number, length = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
