import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { renderer } from '../services/renderer/index.js';
import { Leaderboard } from '../services/renderer/templates/Leaderboard.js';
import { xpStore } from '../services/xp/store.js';
import React from 'react';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Mostra o ranking de níveis do servidor');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: '❌ Este comando só funciona em servidores.', flags: 64 });
    return;
  }

  await interaction.deferReply();

  const guildId = interaction.guildId;

  try {
    // 1. Buscar top 10 usuários
    const topUsers = await xpStore.getTopUsers(guildId, 10);

    // 2. Preparar dados para o template
    const activeUsers = await Promise.all(topUsers.map(async (userData: any, index: number) => {
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
        rank: index + 1,
        username: displayName,
        level: userData.level,
        xpProgress: xpProgress,
        avatarUrl,
        isTop3: index < 3
      };
    }));

    if (activeUsers.length === 0) {
      await interaction.editReply('Ainda não há ninguém no ranking!');
      return;
    }

    // 3. Renderizar Imagem
    // Altura dinâmica baseada no número de usuários (aprox 70px por user + 100px header/footer)
    const height = 100 + (activeUsers.length * 70);

    const pngBuffer = await renderer.renderToPNG(
      React.createElement(Leaderboard, {
        users: activeUsers,
        guildName: interaction.guild.name
      }),
      { width: 600, height: height }
    );

    const attachment = new AttachmentBuilder(pngBuffer, { name: 'leaderboard.png' });

    // 4. Botão
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Ver Top 100')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com')
          .setEmoji('📊')
      );

    await interaction.editReply({
      files: [attachment],
      components: [row]
    });

  } catch (err) {
    console.error('Error generating rank:', err);
    await interaction.editReply({
      content: '❌ Erro ao gerar ranking. Tente novamente.',
    });
  }
}
