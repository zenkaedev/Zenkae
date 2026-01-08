import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
import { renderer } from '../services/renderer/index.js';
import { FerrariLeaderboard } from '../services/renderer/templates/FerrariLeaderboard.js';
import { xpStore } from '../services/xp/store.js';
import React from 'react';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Mostra o ranking de níveis do servidor (Ferrari Edition 🏎️)');

export async function execute(interaction: ChatInputCommandInteraction) {
  console.log('[RANK] Command started for user:', interaction.user.tag);
  if (!interaction.inCachedGuild()) {
    console.log('[RANK] Not in cached guild');
    return;
  }

  await interaction.deferReply();
  console.log('[RANK] Deferred reply');
  const guildId = interaction.guildId;

  // State
  let currentPage = 1;
  const ITEMS_PER_PAGE = 7; // Ajustado para caber bem na imagem

  // Helper para gerar o payload (imagem + componentes)
  const generatePayload = async (page: number) => {
    console.log(`[RANK] Generatng payload for page ${page}`);
    // Buscar top users com paginação (simulada no slice por enquanto se store não suportar, 
    // mas ideal é store suportar skip/take. store.getTopUsers aceita limit, vamos pegar bastante e fatiar aqui 
    // ou idealmente alterar store. Mas por segurança e rapidez: pegamos top 50 e paginamos em memória.)

    // Nota: Para "Ferrari", vamos assumir que queremos rapidez.
    // O ideal seria xpStore.getTopUsers(guildId, skip, take).
    // Como getTopUsers hoje só tem (guildId, limit), vamos pegar 50 e paginar em memória.

    const allTopUsers = await xpStore.getTopUsers(guildId, 50);
    console.log(`[RANK] Fetched ${allTopUsers.length} top users`);
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const pageUsers = allTopUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const activeUsers = await Promise.all(pageUsers.map(async (userData: any, index: number) => {
      let displayName = 'Usuário Desconhecido';
      let avatarUrl = '';

      try {
        const member = await interaction.guild.members.fetch(userData.userId).catch(() => null);
        if (member) {
          displayName = member.displayName;
          avatarUrl = member.displayAvatarURL({ extension: 'png', size: 128 });
        }
      } catch (e) {
        // ignore
      }

      const { xpProgress } = await xpStore.getUserLevel(guildId, userData.userId);

      return {
        rank: startIndex + index + 1,
        username: displayName,
        level: userData.level,
        xpProgress: xpProgress,
        avatarUrl
      };
    }));

    if (activeUsers.length === 0 && page > 1) {
      return null; // Página vazia
    }

    console.log('[RANK] Rendering image...');
    try {
      // Renderizar
      const height = 140 + (activeUsers.length * 85); // Ajuste fino para o layout novo
      const pngBuffer = await renderer.renderToPNG(
        React.createElement(FerrariLeaderboard, {
          users: activeUsers,
          guildName: interaction.guild.name,
          page: page
        }),
        { width: 700, height: height } // Um pouco mais largo para "Ferrari" look
      );
      console.log('[RANK] Image rendered successfully');

      const attachment = new AttachmentBuilder(pngBuffer, { name: `leaderboard_${page}.png` });

      // Componentes
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
            .setDisabled(pageUsers.length < ITEMS_PER_PAGE), // Desabilita se não encheu a página
          new ButtonBuilder()
            .setLabel('Ver Dashboard')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com')
        );

      return { files: [attachment], components: [filterRow, navRow] };
    } catch (renderError) {
      console.error('[RANK] Render Error:', renderError);
      throw renderError;
    }
  };

  try {
    // 1. Enviar primeira página
    console.log('[RANK] Calling initial generatePayload');
    const initialPayload = await generatePayload(currentPage);
    if (!initialPayload) {
      console.log('[RANK] No payload generated');
      await interaction.editReply('Sem dados de ranking.');
      return;
    }

    console.log('[RANK] Sending editReply');
    const message = await interaction.editReply(initialPayload);
    console.log('[RANK] Reply sent');

    // 2. Collector de Interatividade
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minuto de interação
    });

    collector.on('collect', async (i) => {
      console.log('[RANK] Interaction collected:', i.customId);
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '❌ Você não pode controlar este painel.', flags: 64 });
        return;
      }

      await i.deferUpdate(); // Feedback tátil imediato "carregando"

      if (i.customId === 'prev') {
        currentPage = Math.max(1, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage++;
      }

      const newPayload = await generatePayload(currentPage);
      if (newPayload) {
        await i.editReply(newPayload);
      } else {
        // Se página vazia, volta
        currentPage--;
      }
    });

    collector.on('end', () => {
      // Opcional: Desabilitar botões após expirar
      interaction.editReply({ components: [] }).catch(() => { });
    });
  } catch (err) {
    console.error('[RANK] Critical Error:', err);
    // Try to notify user if defer happened
    try {
      await interaction.editReply('❌ Ocorreu um erro interno ao gerar o ranking.');
    } catch (e) {
      console.error('[RANK] Failed to send error message:', e);
    }
  }
}
