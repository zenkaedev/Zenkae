// src/commands/rank.ts
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { getLiveSecondsForGuild, getLiveSecondsForGuildSince } from '../listeners/voiceActivity.js';

const prisma = new PrismaClient();

function startOfISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // 1..7 (segunda=1)
  if (day > 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Ranking de atividade em call')
  .addSubcommand((s) => s.setName('all').setDescription('Ranking geral (tempo total)'))
  .addSubcommand((s) => s.setName('week').setDescription('Ranking da semana (inicia na segunda-feira)'))
  .setDMPermission(false);

export async function execute(inter: ChatInputCommandInteraction) {
  if (!inter.inGuild() || !inter.guildId) {
    await inter.reply({ content: 'Use este comando em um servidor.', ephemeral: true });
    return;
  }

  // ✅ DEFER IMEDIATO para não estourar timeout
  try {
    if (!inter.deferred && !inter.replied) await inter.deferReply({ ephemeral: false });
  } catch {}

  try {
    const sub = inter.options.getSubcommand(false) ?? 'all';
    const guildId = inter.guildId!;
    const invokerId = inter.user.id;

    const toHours = (s: number) => Math.floor(s / 3600);

    let enriched: Array<{ userId: string; totalSeconds: number }> = [];
    let mySeconds = 0;
    let title = '🏆 Ranking de Atividade';

    if (sub === 'week') {
      title = '🏆 Ranking de Atividade (Semana)';
      const weekStart = startOfISOWeek(new Date());
      const top = await prisma.voiceActivityWeek.findMany({
        where: { guildId, weekStart },
        orderBy: { totalSeconds: 'desc' },
        take: 50,
      });
      const me = await prisma.voiceActivityWeek.findUnique({
        where: { guildId_userId_weekStart: { guildId, userId: invokerId, weekStart } },
      });
      const live = getLiveSecondsForGuildSince(guildId, weekStart);
      const applyLive = (userId: string, base: number) => base + (live.get(userId) ?? 0);

      enriched = top.map((r) => ({ userId: r.userId, totalSeconds: applyLive(r.userId, r.totalSeconds) }))
                    .sort((a, b) => b.totalSeconds - a.totalSeconds);

      mySeconds = applyLive(invokerId, me?.totalSeconds ?? 0);
    } else {
      // all (geral)
      title = '🏆 Ranking de Atividade (Geral)';
      const top = await prisma.voiceActivity.findMany({
        where: { guildId },
        orderBy: { totalSeconds: 'desc' },
        take: 50,
      });
      const me = await prisma.voiceActivity.findUnique({
        where: { guildId_userId: { guildId, userId: invokerId } },
      });
      const live = getLiveSecondsForGuild(guildId);
      const applyLive = (userId: string, base: number) => base + (live.get(userId) ?? 0);

      enriched = top.map((r) => ({ userId: r.userId, totalSeconds: applyLive(r.userId, r.totalSeconds) }))
                    .sort((a, b) => b.totalSeconds - a.totalSeconds);

      mySeconds = applyLive(invokerId, me?.totalSeconds ?? 0);
    }

    // Buscar display names
    const names = new Map<string, string>();
    await Promise.all(
      enriched.map(async (r) => {
        try { const m = await inter.guild!.members.fetch(r.userId); names.set(r.userId, m.displayName); }
        catch { names.set(r.userId, `Usuário ${r.userId}`); }
      })
    );

    // Montar linhas top 50
    const lines: string[] = [];
    for (let i = 0; i < enriched.length; i++) {
      const r = enriched[i]!;
      const pos = i + 1;
      const hrs = toHours(r.totalSeconds);
      const name = names.get(r.userId) ?? r.userId;

      let prefix = `${pos} -`;
      if (pos === 1) prefix = '🥇';
      else if (pos === 2) prefix = '🥈';
      else if (pos === 3) prefix = '🥉';

      lines.push(`${prefix} ${name} — ${hrs}hrs`);
    }

    // Posição do autor
    // (Para precisão total, ideal seria recomputar globalmente com live; aqui mantemos simples.)
    let myPosText = '';
    const inTop = enriched.findIndex((r) => r.userId === invokerId) !== -1;
    if (!inTop) {
      myPosText = `\nSua posição é — ${toHours(mySeconds)}hr${toHours(mySeconds) !== 1 ? 's' : ''}`;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(lines.join('\n') + myPosText)
      .setColor(0xfee75c)
      .setFooter({ text: `Atualizado em ${new Date().toLocaleString()}` });

    await inter.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('rank error:', err);
    if (!inter.replied && !inter.deferred) {
      await inter.reply({ content: '❌ Falha ao gerar o ranking.', ephemeral: true }).catch(() => {});
    } else {
      await inter.editReply({ content: '❌ Falha ao gerar o ranking.' }).catch(() => {});
    }
  }
}

export default { data, execute };
