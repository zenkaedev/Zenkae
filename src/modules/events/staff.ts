import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type InteractionUpdateOptions,
  type GuildTextBasedChannel,
} from 'discord.js';
import { eventsStore } from './store.js';
import type { EventWithCounts } from './types.js';
import { buildScreen, replyV2Notice } from '../../ui/v2.js';

function brDate(dt: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(dt);
}

export async function buildEventsList(guildId: string) {
  const list = await eventsStore.listUpcomingWithCounts(guildId, 5);
  return list;
}

export function buildEventsTabContent(list: EventWithCounts[]): InteractionUpdateOptions {
  const lines: string[] = [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (const e of list) {
    lines.push(
      `- **${e.title}** — ${brDate(new Date(e.startsAt))} · ✅ ${e.yes} · ❔ ${e.maybe} · ❌ ${e.no}`,
    );
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`events:notify:${e.id}`)
          .setLabel('Notificar confirmados')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`events:cancel:${e.id}`)
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  if (list.length === 0) lines.push('_Nenhum evento agendado._');

  return {
    content: `# Zenkae • EVENTS\n> Crie, gerencie RSVP e envie lembretes.\n\n${lines.join('\n')}`,
    components: rows,
  };
}

export async function notifyConfirmed(inter: ButtonInteraction, eventId: string) {
  const list = await eventsStore.listConfirmedUsers(eventId);
  if (list.length === 0) {
    await replyV2Notice(inter, 'Não há confirmados para notificar.', true);
    return;
  }

  let ok = 0,
    fail = 0;
  for (const r of list) {
    try {
      const u = await inter.client.users.fetch(r.userId);
      await u.send(
        `🔔 Lembrete: você confirmou presença no evento de **${inter.guild?.name}**. Até lá!`,
      );
      ok++;
    } catch {
      fail++;
    }
  }
  await replyV2Notice(
    inter,
    `✅ Notifiquei ${ok} usuário(s).${fail ? ` Falhas: ${fail}.` : ''}`,
    true,
  );
}

export async function cancelEvent(inter: ButtonInteraction, eventId: string) {
  if (!inter.inCachedGuild()) return;
  const ev = await eventsStore.getById(eventId);
  if (!ev) {
    await replyV2Notice(inter, 'Evento não encontrado.', true);
    return;
  }
  await eventsStore.setStatus(eventId, 'cancelled');

  try {
    const ch = inter.channel!;
    const msg = await (ch as GuildTextBasedChannel).messages.fetch(ev.messageId);
    await msg.edit(
      buildScreen({
        title: `❌ [CANCELADO] ${ev.title}`,
        subtitle: `Era: ${brDate(new Date(ev.startsAt))}`,
        body: '*Este evento foi cancelado.*',
      }),
    );
  } catch {
    // ignore
  }

  await replyV2Notice(inter, `✅ Evento **${ev.title}** cancelado.`, true);
}
