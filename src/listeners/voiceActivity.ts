// src/listeners/voiceActivity.ts
import { Client, Events } from 'discord.js';
import type { PrismaClient } from '@prisma/client';

type Session = { startedAt: number; channelId: string };
type Key = `${string}:${string}`;
const sessions = new Map<Key, Session>();
const keyOf = (g: string, u: string) => `${g}:${u}` as const;

function startOfISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // 1..7 (segunda=1)
  if (day > 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function commitSeconds(
  prisma: PrismaClient,
  guildId: string,
  userId: string,
  seconds: number,
) {
  if (seconds <= 0) return;
  // total
  await prisma.voiceActivity.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: { totalSeconds: { increment: seconds } },
    create: { guildId, userId, totalSeconds: seconds },
  });
  // semanal (usa a semana atual no momento do commit)
  const weekStart = startOfISOWeek(new Date());
  await prisma.voiceActivityWeek.upsert({
    where: { guildId_userId_weekStart: { guildId, userId, weekStart } },
    update: { totalSeconds: { increment: seconds } },
    create: { guildId, userId, weekStart, totalSeconds: seconds },
  });
}

export function registerVoiceActivity(client: Client, prisma: PrismaClient) {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member?.user.bot || oldState.member?.user.bot) return;

    const before = oldState.channelId;
    const after = newState.channelId;
    if (before === after) return; // mute/deaf/etc.

    const guildId = newState.guild.id;
    const userId = newState.id;
    const key = keyOf(guildId, userId);
    const afkId = newState.guild.afkChannelId ?? null;
    const now = Date.now();

    // fechar sessão anterior
    const sess = sessions.get(key);
    if (sess) {
      const seconds = Math.floor((now - sess.startedAt) / 1000);
      try {
        await commitSeconds(prisma, guildId, userId, seconds);
      } catch {
        // ignore
      }
      sessions.delete(key);
    }

    // abrir nova sessão (se entrou e não é AFK)
    if (after && after !== afkId) {
      sessions.set(key, { startedAt: now, channelId: after });
    }
  });

  client.once(Events.ClientReady, async (c) => {
    // Semeia sessões p/ quem já está em call quando o bot sobe
    for (const [, guild] of c.guilds.cache) {
      try {
        await guild.channels.fetch();
        const afkId = guild.afkChannelId ?? null;
        guild.channels.cache.forEach((ch) => {
          if (!ch.isVoiceBased()) return;
          if (ch.id === afkId) return;
          for (const [memberId, member] of ch.members) {
            if (member.user?.bot) continue;
            const key = keyOf(guild.id, memberId);
            if (!sessions.has(key)) sessions.set(key, { startedAt: Date.now(), channelId: ch.id });
          }
        });
      } catch {
        // ignore
      }
    }
  });

  // helpers expostos (para /rank)
  (registerVoiceActivity as any).getLiveSecondsForGuild = (guildId: string) => {
    const now = Date.now();
    const map = new Map<string, number>();
    for (const [key, sess] of sessions) {
      if (!key.startsWith(`${guildId}:`)) continue;
      const userId = key.split(':')[1]!;
      const extra = Math.max(0, Math.floor((now - sess.startedAt) / 1000));
      if (extra > 0) map.set(userId, extra);
    }
    return map;
  };
  (registerVoiceActivity as any).getLiveSecondsForGuildSince = (
    guildId: string,
    sinceMs: number,
  ) => {
    const now = Date.now();
    const map = new Map<string, number>();
    for (const [key, sess] of sessions) {
      if (!key.startsWith(`${guildId}:`)) continue;
      const userId = key.split(':')[1]!;
      const start = Math.max(sinceMs, sess.startedAt);
      const extra = Math.max(0, Math.floor((now - start) / 1000));
      if (extra > 0) map.set(userId, extra);
    }
    return map;
  };
}

export function getLiveSecondsForGuild(guildId: string): Map<string, number> {
  const f = (registerVoiceActivity as any).getLiveSecondsForGuild as
    | ((g: string) => Map<string, number>)
    | undefined;
  return f ? f(guildId) : new Map();
}

export function getLiveSecondsForGuildSince(guildId: string, since: Date): Map<string, number> {
  const f = (registerVoiceActivity as any).getLiveSecondsForGuildSince as
    | ((g: string, s: number) => Map<string, number>)
    | undefined;
  return f ? f(guildId, since.getTime()) : new Map();
}
