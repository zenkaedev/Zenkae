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

      // Calcular progresso
      const { xpInCurrentLevel, xpForNextLevel, xpProgress } = await xpStore.getUserLevel(guildId, userData.userId);

      // ANSI Bar Logic
      // Total Length: 15 chars for high resolution
      const size = 15;
      const percentage = Math.min(Math.max(xpInCurrentLevel / xpForNextLevel, 0), 1);
      const progress = Math.round(size * percentage);
      const empty = size - progress;

      // ANSI Colors: [1;35m (Bold Magenta/Purple) matches the reference

      const filledChar = '█';
      const emptyChar = ' ';

      const barStr = filledChar.repeat(progress);
      const emptyStr = emptyChar.repeat(empty);

      // ANSI Format: Purple Input for Bar, Gray for Empty + Percentage Badge
      const percentStr = `${Math.floor(xpProgress)}%`.padStart(4, ' ');

      const ansiBar = ` [1;35m${barStr} [1;30m${emptyStr} [0m  [1;37m${percentStr} [0m`;

      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

      return `**${medal}** — **[Nível ${userData.level}]** ${displayName}\n` +
        `\`\`\`ansi\n${ansiBar}\n\`\`\``;
    }));

    if (lines.length === 0) {
      await interaction.editReply('Ainda não há ninguém no ranking!');
      return;
    }

    // 3. Montar Embed
    const embed = new EmbedBuilder()
      .setColor(0x2B2D31) // Dark Embed Theme
      .setTitle(`🏆 Ranking Global - ${interaction.guild.name}`)
      .setDescription(lines.join('\n')) // Less spacing between items
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
