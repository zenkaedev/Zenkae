import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type GuildTextBasedChannel,
} from 'discord.js';
import { eventsStore } from './store.js';
import type { RsvpChoice } from './types.js';
import { buildScreen, replyV2Notice } from '../../ui/v2.js';

function brDate(dt: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(dt);
}

function eventScreen(params: {
  title: string;
  startsAt: Date;
  description?: string | null;
  counts?: { yes: number; maybe: number; no: number };
  eventId?: string;
}) {
  const { title, startsAt, description, counts, eventId } = params;
  const subtitle = `**Quando:** ${brDate(startsAt)}`;
  const stats = counts ? `\n**Confirmações:** ✅ ${counts.yes} · ❔ ${counts.maybe} · ❌ ${counts.no}\n` : '';
  const hint = eventId ? `\nClique em um botão para responder (pode mudar depois).` : '';
  const body = `${description ? `${description}\n` : ''}${stats}${hint}`.trim() || ' ';

  return buildScreen({
    title: `📅 ${title}`,
    subtitle,
    body,
    buttons: eventId
      ? [
          { id: `events:rsvp:yes:${eventId}`, label: 'Confirmo' },
          { id: `events:rsvp:maybe:${eventId}`, label: 'Talvez' },
          { id: `events:rsvp:no:${eventId}`, label: 'Não vou' },
        ]
      : undefined,
  });
}

export async function openNewEventModal(inter: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId('events:new:modal').setTitle('Novo Evento');

  const title = new TextInputBuilder().setCustomId('title').setLabel('Título do evento').setRequired(true).setStyle(TextInputStyle.Short).setMaxLength(80);
  const date = new TextInputBuilder().setCustomId('date').setLabel('Data (AAAA-MM-DD)').setRequired(true).setStyle(TextInputStyle.Short).setMaxLength(10);
  const time = new TextInputBuilder().setCustomId('time').setLabel('Hora (HH:mm)').setRequired(true).setStyle(TextInputStyle.Short).setMaxLength(5);
  const desc = new TextInputBuilder().setCustomId('desc').setLabel('Descrição (opcional)').setRequired(false).setStyle(TextInputStyle.Paragraph).setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(title),
    new ActionRowBuilder<TextInputBuilder>().addComponents(date),
    new ActionRowBuilder<TextInputBuilder>().addComponents(time),
    new ActionRowBuilder<TextInputBuilder>().addComponents(desc),
  );

  await inter.showModal(modal);
}

export async function handleNewEventSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild()) return;

  const title = inter.fields.getTextInputValue('title').trim();
  const date = inter.fields.getTextInputValue('date').trim();
  const time = inter.fields.getTextInputValue('time').trim();
  const desc = (inter.fields.getTextInputValue('desc') || '').trim();

  const startsAt = new Date(`${date}T${time}:00`);
  if (isNaN(startsAt.getTime())) {
    await replyV2Notice(inter, '❌ Data/Hora inválidas. Use o formato AAAA-MM-DD e HH:mm.', true);
    return;
  }

  const channel = inter.channel;
  if (!channel?.isTextBased()) {
    await replyV2Notice(inter, '❌ Use em um canal de texto.', true);
    return;
  }

  const placeholder = eventScreen({ title, startsAt, description: desc, eventId: 'pending' });
  const sent = await (channel as GuildTextBasedChannel).send(placeholder);

  const saved = await eventsStore.create({
    guildId: inter.guildId!,
    title,
    description: desc || undefined,
    startsAt,
    channelId: channel.id,
    messageId: sent.id,
  });

  const counts = await eventsStore.stats(saved.id);
  await sent.edit(eventScreen({ title, startsAt, description: desc, counts, eventId: saved.id }));

  await replyV2Notice(inter, `✅ Evento **${title}** criado para ${brDate(startsAt)}.`, true);
}

export async function handleRsvpClick(inter: ButtonInteraction, choice: RsvpChoice, eventId: string) {
  if (!inter.inCachedGuild()) return;

  const ev = await eventsStore.getById(eventId);
  if (!ev || ev.status !== 'scheduled') {
    await replyV2Notice(inter, '❌ Este evento não está disponível.', true);
    return;
  }

  await eventsStore.rsvp(eventId, inter.guildId!, inter.user.id, choice);
  const counts = await eventsStore.stats(eventId);

  try {
    const ch = inter.channel!;
    const msg = await (ch as GuildTextBasedChannel).messages.fetch(ev.messageId);
    await msg.edit(eventScreen({
      title: ev.title,
      startsAt: new Date(ev.startsAt),
      description: ev.description || undefined,
      counts,
      eventId: ev.id,
    }));
  } catch {}

  const txt = choice === 'yes' ? 'Confirmo' : choice === 'maybe' ? 'Talvez' : 'Não vou';
  await replyV2Notice(inter, `✅ Resposta registrada: **${txt}**.`, true);
}
