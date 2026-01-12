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
import { logger } from '../infra/logger.js';
// Import V2 internal helpers
import { Brand, getBuilders } from '../ui/v2.js';
import { EMOJI } from '../ui/icons.generated.js';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Mostra o ranking de níveis do servidor (V2)');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) return;

  // Check V2 Support
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = getBuilders();

  if (!ContainerBuilder || !TextDisplayBuilder) {
    await interaction.reply({ content: '❌ Este bot não suporta Components V2 (Container/TextDisplay). Verifique a versão da biblioteca.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();
  const guildId = interaction.guildId;

  // State
  let currentPage = 1;
  let currentFilter: 'global' | 'monthly' | 'weekly' = 'global'; // Track current filter
  const ITEMS_PER_PAGE = 7;

  // Helper para gerar o payload (Components V2)
  const generatePayload = async (page: number, filter: 'global' | 'monthly' | 'weekly' = 'global') => {

    // State
    let range: 'global' | 'WEEKLY' | 'MONTHLY' = filter === 'weekly' ? 'WEEKLY' : filter === 'monthly' ? 'MONTHLY' : 'global';

    if (range === 'WEEKLY' || range === 'MONTHLY') {
      // Force rotation check when viewing rank (lazy check)
      await import('../services/xp/rotation.js').then(m => m.rotationService.checkRotations(guildId).catch(() => { }));
    }

    const allTopUsers = range === 'global'
      ? await xpStore.getTopUsers(guildId, 50)
      : await xpStore.getPeriodTopUsers(guildId, range, 50);

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const pageUsers = allTopUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // FIX #4: Batch fetch ao invés de N+1 queries
    // ANTES: 7 users = 7 member fetches + 7 XP queries = 14 queries
    // DEPOIS: 7 users = 1 batch member fetch + 1 batch XP query = 2 queries

    const userIds = pageUsers.map((u) => u.userId);

    // Batch fetch members (1 única query ao Discord)
    const members = await interaction.guild.members.fetch({
      user: userIds
    }).catch(() => new Map());

    // Batch fetch XP stats (1 única query ao DB) - APENAS para global
    const batchStats = range === 'global'
      ? await xpStore.getBatchUserLevels(guildId, userIds)
      : null;

    // Processar dados já carregados (sem queries adicionais)
    // Union type para suportar tanto UserXP (global) quanto PeriodUserXP (weekly/monthly)
    type RankUserData = { userId: string; level?: number; xp?: number };
    const activeUsers = (pageUsers as RankUserData[]).map((userData, index: number) => {
      const member = members.get(userData.userId);
      const displayName = member?.displayName || 'Usuário Desconhecido';

      let xpProgress = 0;
      let levelLabel = '';

      if (range === 'global') {
        const stats = batchStats?.get(userData.userId);
        xpProgress = stats?.xpProgress || 0;
        levelLabel = `Lvl ${userData.level || 1}`;
      } else {
        xpProgress = 100;
        levelLabel = `${userData.xp?.toLocaleString() || 0} XP`;
      }

      return {
        rank: startIndex + index + 1,
        username: displayName,
        levelLabel,
        xpProgress: xpProgress
      };
    });

    if (activeUsers.length === 0 && page > 1) {
      return null;
    }

    // --- Build V2 Container ---
    const container = new ContainerBuilder().setAccentColor(Brand.purple);

    // Header
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${interaction.guild.name}\n🏆 Leaderboard • Página ${page}`)
    );

    // List
    for (const [index, user] of activeUsers.entries()) {
      // Create a divider before every item (except perhaps the very first one if we want it clean, but User showed dividers separating them).
      // actually User showed: Header \n Divisor \n Item 1 \n Divisor \n Item 2.
      // So checking index.
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

      const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`;
      const progressBar = createEmojiProgressBar(user.xpProgress);
      const percentBox = `\`${Math.floor(user.xpProgress)}%\``;

      // Format:
      // 🥇 — [Nível 4] Junão!
      // [Barra] 47%
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${medal}** — **[${user.levelLabel}]** ${user.username}\n` +
          `${progressBar} ${percentBox}`
        )
      );
    }

    if (activeUsers.length === 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Nenhum usuário encontrado neste ranking ainda.')
      );
    }

    // Controls (Filter & Nav)
    const filterRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rank_filter')
          .setPlaceholder('Filtrar Ranking')
          .addOptions([
            { label: '🏆 Global (Todo o tempo)', value: 'global', default: range === 'global' },
            { label: '📅 Mensal (XP do Mês)', value: 'monthly', description: 'Ranking deste mês', default: range === 'MONTHLY' },
            { label: '🗓️ Semanal', value: 'weekly', description: 'Ranking desta semana', default: range === 'WEEKLY' }
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
          .setDisabled(pageUsers.length < ITEMS_PER_PAGE)
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
    const initialPayload = await generatePayload(currentPage, currentFilter);
    if (!initialPayload) {
      await interaction.editReply('Sem dados de ranking.');
      return;
    }

    const message = await interaction.editReply(initialPayload);

    // 2. Collector (listen to both StringSelect and Buttons)
    const collector = message.createMessageComponentCollector({
      time: 60000,
      max: 50 // Limit interactions to prevent memory leak
    });


    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '❌ Você não pode controlar este painel.', flags: 64 });
        return;
      }

      await i.deferUpdate();

      // Handle filter changes from StringSelect
      if (i.isStringSelectMenu() && i.customId === 'rank_filter') {
        currentFilter = i.values[0] as 'global' | 'monthly' | 'weekly';
        currentPage = 1; // Reset to page 1 when changing filters
      }
      // Handle pagination buttons
      else if (i.isButton()) {
        if (i.customId === 'prev') {
          currentPage = Math.max(1, currentPage - 1);
        } else if (i.customId === 'next') {
          currentPage++;
        }
      }

      const newPayload = await generatePayload(currentPage, currentFilter);
      if (newPayload) {
        await i.editReply(newPayload);
      } else if (i.isButton() && i.customId === 'next') {
        currentPage--; // Revert if no data
      }
    });

    // CRITICAL: Cleanup collector on end to prevent memory leak
    collector.on('end', () => {
      logger.debug({ userId: interaction.user.id }, 'Rank collector stopped');
    });
  } catch (err) {
    logger.error({ error: err, userId: interaction.user.id }, 'Error rendering rank V2');
    try { await interaction.editReply('❌ Erro ao renderizar ranking V2.'); } catch { }
  }
}


/**
 * Cria uma barra de progresso visual usando Emojis Customizados
 * Estilo: [Start][Mid][Mid][Mid][End]
 * Concatenação DIRETA sem nenhum caractere entre emojis
 */
function createEmojiProgressBar(percentage: number, length: number = 8): string {
  const p = Math.max(0, Math.min(100, percentage));

  // Se 100%, barra full perfeita
  if (p >= 100) {
    return EMOJI.progressbar.bar_full_start.markup +
      EMOJI.progressbar.bar_full_mid.markup.repeat(length) +
      EMOJI.progressbar.bar_full_end.markup;
  }

  // Se 0%, barra vazia perfeita
  if (p <= 0) {
    return EMOJI.progressbar.bar_empty_start.markup +
      EMOJI.progressbar.bar_empty_mid.markup.repeat(length) +
      EMOJI.progressbar.bar_empty_end.markup;
  }

  const totalBlocks = length;
  const filledBlocks = Math.round((p / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;

  let bar = EMOJI.progressbar.bar_full_start.markup;
  bar += EMOJI.progressbar.bar_full_mid.markup.repeat(filledBlocks);
  bar += EMOJI.progressbar.bar_empty_mid.markup.repeat(emptyBlocks);
  bar += (filledBlocks === totalBlocks)
    ? EMOJI.progressbar.bar_full_end.markup
    : EMOJI.progressbar.bar_empty_end.markup;

  return bar;
}
