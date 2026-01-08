import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  GuildMember
} from 'discord.js';
import { xpStore } from '../services/xp/store.js';
import { createProgressBar } from '../utils/progressBar.js';

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

    // 2. Construir lista de exibição
    let topOneAvatar: string | null = null;

    const lines = await Promise.all(topUsers.map(async (userData: any, index: number) => {
      let displayName = 'Usuário Desconhecido';
      let avatarUrl: string | null = null;

      try {
        const member = await interaction.guild.members.fetch(userData.userId).catch(() => null);
        if (member) {
          displayName = member.displayName;
          avatarUrl = member.displayAvatarURL({ extension: 'png', size: 256 });
        }
      } catch (e) {
        // ignore fetch error
      }

      if (index === 0 && avatarUrl) topOneAvatar = avatarUrl;

      // Calcular progresso do nível atual
      const { xpInCurrentLevel, xpForNextLevel, xpProgress } = await xpStore.getUserLevel(guildId, userData.userId);
      // Usando caracteres mais densos para simular barra contínua
      const progressBar = createProgressBar(xpInCurrentLevel, xpForNextLevel, 10).replace(/▰/g, '▇').replace(/▱/g, '—');

      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

      return `**${medal}** — **[Nível ${userData.level}]** ${displayName}\n` +
        `> ${progressBar} \` ${Math.floor(xpProgress)}% \``;
    }));

    if (lines.length === 0) {
      await interaction.editReply('Ainda não há ninguém no ranking!');
      return;
    }

    // 3. Montar Embed
    const embed = new EmbedBuilder()
      .setColor(0x5865F2) // Blurple
      .setTitle(`🏆 Ranking Global - ${interaction.guild.name}`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: 'Atualizado em tempo real' })
      .setTimestamp();

    if (topOneAvatar) {
      embed.setThumbnail(topOneAvatar);
    }

    // 4. Botão (Placeholder)
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Ver Top 100')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com') // TODO: Colocar URL real do dashboard
          .setEmoji('📊')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  } catch (err) {
    console.error('Error generating rank:', err);
    await interaction.editReply({
      content: '❌ Erro ao gerar ranking. Tente novamente.',
    });
  }
}
