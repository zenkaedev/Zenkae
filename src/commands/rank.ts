// src/commands/rank.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { renderer } from '../services/renderer/index.js';
import { RankList } from '../services/renderer/templates/RankList.js';
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

  await interaction.deferReply(); // Rendering pode levar ~1s

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  try {
    // 1. Buscar top 10 usuários
    const topUsers = await xpStore.getTopUsers(guildId, 10);

    // 2. Buscar rank do usuário que solicitou
    const userRank = await xpStore.getUserRank(guildId, userId);

    // 3. Transformar dados para o template
    const rankedUsers = await Promise.all(
      topUsers.map(async (userData: any, index: number) => {
        const user = await interaction.client.users.fetch(userData.userId).catch(() => null);
        return {
          userId: userData.userId,
          username: user?.username || 'Usuário Desconhecido',
          avatarUrl: user?.displayAvatarURL({ size: 128, extension: 'png' }) || '',
          level: userData.level,
          xpTotal: userData.xpTotal,
          rank: index + 1,
        };
      })
    );

    // 4. Se o usuário não está no top 10, buscar seus dados
    let requestingUserData = undefined;
    if (userRank > 10) {
      const userData = await xpStore.getUserLevel(guildId, userId);
      const user = await interaction.client.users.fetch(userId);
      requestingUserData = {
        userId,
        username: user.username,
        avatarUrl: user.displayAvatarURL({ size: 128, extension: 'png' }),
        level: userData.level,
        xpTotal: userData.xpTotal,
        rank: userRank,
      };
    }

    // 5. Renderizar imagem
    const pngBuffer = await renderer.renderToPNG(
      React.createElement(RankList, {
        topUsers: rankedUsers,
        requestingUser: requestingUserData,
        guildName: interaction.guild.name,
        guildColor: '#FFD700',
      }),
      { width: 900, height: 1200 }
    );

    // 6. Enviar como attachment
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'rank.png' });

    await interaction.editReply({
      files: [attachment],
    });
  } catch (err) {
    console.error('Error generating rank:', err);
    await interaction.editReply({
      content: '❌ Erro ao gerar ranking. Tente novamente.',
    });
  }
}
