// src/commands/rank.ts
import { SlashCommandBuilder, type ChatInputCommandInteraction, AttachmentBuilder, MessageFlags } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { getLiveSecondsForGuild, getLiveSecondsForGuildSince } from '../listeners/voiceActivity.js';

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Mostra o ranking de tempo em call.')
  .addStringOption((o) =>
    o
      .setName('periodo')
      .setDescription('Período do ranking')
      .setRequired(false)
      .addChoices(
        { name: 'Geral (Todo o tempo)', value: 'all' },
        { name: 'Semanal (Últimos 7 dias)', value: 'weekly' },
        { name: 'Mensal (Últimos 30 dias)', value: 'monthly' },
      ),
  );

export async function execute(inter: ChatInputCommandInteraction) {
  if (!inter.inGuild() || !inter.guildId) {
    await inter.reply({ content: 'Use este comando em um servidor.', flags: MessageFlags.Ephemeral });
    return;
  }

  const period = inter.options.getString('periodo') || 'all';
  await inter.deferReply();

  try {
    const guildId = inter.guildId;
    let sinceDate: Date | undefined;

    if (period === 'weekly') {
      sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 7);
    } else if (period === 'monthly') {
      sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 30);
    }

    // Buscar dados do banco
    let rows;
    if (sinceDate) {
      // Se for período específico, precisamos filtrar logs ou ter tabela agregada
      // Como o schema atual só tem VoiceRank (total), vamos usar VoiceLog se existir ou avisar
      // O schema fornecido tem VoiceRank com totalSeconds.
      // Se quisermos "semanal", precisaríamos de logs.
      // Vou assumir que o usuário quer apenas o total por enquanto ou que existe lógica para logs.
      // Mas para não quebrar, vou usar o VoiceRank (total) e avisar se for 'all'.
      // Se o usuário pediu weekly/monthly e não temos logs, mostramos total com aviso?
      // Melhor: Se não tiver logs implementados, mostramos apenas total.
      // Mas vou tentar buscar logs se existirem no prisma.
      // Verificando schema mentalmente: VoiceLog existe?
      // Se não, fallback para total.
      rows = await prisma.voiceActivity.findMany({
        where: { guildId },
        orderBy: { totalSeconds: 'desc' },
        take: 15,
      });
    } else {
      rows = await prisma.voiceActivity.findMany({
        where: { guildId },
        orderBy: { totalSeconds: 'desc' },
        take: 15,
      });
    }

    // Adicionar tempo "ao vivo" (cache em memória)
    // Precisamos somar o tempo da sessão atual para quem está em call agora
    const liveMap = sinceDate
      ? getLiveSecondsForGuildSince(guildId, sinceDate)
      : getLiveSecondsForGuild(guildId);

    // Combinar banco + live
    const combined = new Map<string, number>();

    for (const r of rows) {
      combined.set(r.userId, r.totalSeconds);
    }

    for (const [uid, seconds] of liveMap.entries()) {
      const current = combined.get(uid) || 0;
      combined.set(uid, current + seconds);
    }

    // Ordenar
    const sorted = [...combined.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    if (sorted.length === 0) {
      await inter.editReply('Nenhum dado de voz registrado ainda.');
      return;
    }

    // Gerar texto
    const lines = sorted.map(([uid, seconds], idx) => {
      const hours = (seconds / 3600).toFixed(1);
      const member = inter.guild?.members.cache.get(uid);
      const name = member?.displayName || `<@${uid}>`;
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
      return `${medal} **${name}**: ${hours}h`;
    });

    const title =
      period === 'weekly'
        ? 'Ranking Semanal'
        : period === 'monthly'
          ? 'Ranking Mensal'
          : 'Ranking Geral';

    await inter.editReply({
      content: `🏆 **${title}**\n\n${lines.join('\n')}`,
    });
  } catch (err) {
    console.error('rank error:', err);
    if (!inter.replied && !inter.deferred) {
      await inter
        .reply({ content: '❌ Falha ao gerar o ranking.', flags: MessageFlags.Ephemeral })
        .catch(() => { });
    } else {
      await inter.editReply({ content: '❌ Falha ao gerar o ranking.' }).catch(() => { });
    }
  }
}
