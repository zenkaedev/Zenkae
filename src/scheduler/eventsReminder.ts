import type { Client, GuildTextBasedChannel } from 'discord.js';
import { eventsStore } from '../modules/events/store.js';

type ReminderKind = '24h' | '1h' | '15m';

const WINDOWS: Record<ReminderKind, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '1h':  60 * 60 * 1000,
  '15m': 15 * 60 * 1000,
};

export function startEventReminders(client: Client) {
  setInterval(async () => {
    try {
      const now = Date.now();
      const upcoming = await eventsStore.listScheduledInNext(26);

      for (const ev of upcoming) {
        const timeTo = ev.startsAt - now;
        if (timeTo <= 0 || ev.status !== 'scheduled') continue;

        for (const kind of Object.keys(WINDOWS) as ReminderKind[]) {
          const target = WINDOWS[kind];
          if (timeTo <= target && timeTo > target - 65_000) {
            const already = await eventsStore.hasReminder(ev.id, kind);
            if (already) continue;

            const confirmed = await eventsStore.listConfirmedUsers(ev.id);
            let ok = 0;
            for (const r of confirmed) {
              try {
                const u = await client.users.fetch(r.userId);
                await u.send(`🔔 Lembrete: evento **${ev.title}** em ${label(kind)} (${whenStr(ev.startsAt)}).`);
                ok++;
              } catch {}
            }

            try {
              const ch = await client.channels.fetch(ev.channelId);
              if (ch && ch.isTextBased()) {
                await (ch as GuildTextBasedChannel).send(`🔔 **${ev.title}** começa ${label(kind)}. Confirmados notificados por DM.`);
              }
            } catch {}

            await eventsStore.markReminder(ev.id, kind);
            console.log(`[reminder] ${kind} -> ${ev.title} | DMs: ${ok}`);
          }
        }
      }
    } catch (e) {
      console.warn('[reminder] loop error:', e);
    }
  }, 60_000);
}

function label(kind: ReminderKind) {
  if (kind === '24h') return 'em 24 horas';
  if (kind === '1h') return 'em 1 hora';
  return 'em 15 minutos';
}

function whenStr(ts: number) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(ts));
}
