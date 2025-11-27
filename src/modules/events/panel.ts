import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type GuildTextBasedChannel,
} from 'discord.js';
import { eventsStore } from './store.js';
import type { RsvpChoice } from './types.js';
import { replyV2Notice } from '../../ui/v2.js';

/**
 * Gera o payload (Embed + Botões) do cartão de evento.
 * Usa timestamps dinâmicos e visual rico.
 */
function eventPayload(params: {
  title: string;
  startsAt: Date;
  description?: string | null;
  counts?: { yes: number; maybe: number; no: number };
  eventId?: string;
}) {
  const { title, startsAt, description, counts, eventId } = params;
  const ts = Math.floor(startsAt.getTime() / 1000);

  // Embed Principal
  const embed = new EmbedBuilder()
    .setTitle(`📅 ${title}`)
    .setColor(0x6d28d9) // Roxo marca
    .setDescription(description || 'Sem descrição.')
    .addFields(
      { name: 'Início', value: `<t:${ts}:F> (<t:${ts}:R>)`, inline: true },
      {
        name: 'Confirmados',
        value: counts ? `✅ **${counts.yes}**` : '0',
        inline: true,
      },
    )
    .setFooter({ text: 'Clique abaixo para confirmar presença' })
    .setTimestamp();

  // Botões de RSVP
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (eventId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`events:rsvp:yes:${eventId}`)
        .setLabel('Vou')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`events:rsvp:maybe:${eventId}`)
        .setLabel('Talvez')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❔'),
      new ButtonBuilder()
        .setCustomId(`events:rsvp:no:${eventId}`)
        .setLabel('Não vou')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
    );
  } else {
    // Botões desabilitados para preview
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('fake1')
        .setLabel('Vou')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('fake2')
        .setLabel('Talvez')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('fake3')
        .setLabel('Não vou')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
    );
  }

  return { embeds: [embed], components: [row] };
}

export async function openNewEventModal(inter: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId('events:new:modal').setTitle('Novo Evento');

  const title = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Título do evento')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80);

  // Melhoria UX: Placeholder com formato esperado
  const date = new TextInputBuilder()
    .setCustomId('date')
    .setLabel('Data (AAAA-MM-DD)')
    .setPlaceholder('Ex: 2024-12-25')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10);

  const time = new TextInputBuilder()
    .setCustomId('time')
    .setLabel('Hora (HH:mm)')
    .setPlaceholder('Ex: 20:00')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(5);

  const desc = new TextInputBuilder()
    .setCustomId('desc')
    .setLabel('Descrição (opcional)')
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500);

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

  // Validação básica de data
  const startsAt = new Date(`${date}T${time}:00`);
  if (isNaN(startsAt.getTime())) {
    await replyV2Notice(inter, '❌ Data/Hora inválidas. Use o formato AAAA-MM-DD e HH:mm.', true);
    return;
  }

  // Validação: Data no passado?
  if (startsAt.getTime() < Date.now()) {
    await replyV2Notice(inter, '❌ Você não pode criar um evento no passado!', true);
    return;
  }

  const channel = inter.channel;
  if (!channel?.isTextBased()) {
    await replyV2Notice(inter, '❌ Use em um canal de texto.', true);
    return;
  }

  // 1. Envia placeholder
  const payload = eventPayload({ title, startsAt, description: desc, eventId: undefined });
  const sent = await (channel as GuildTextBasedChannel).send(payload);

  // 2. Salva no banco
  const saved = await eventsStore.create({
    guildId: inter.guildId!,
    title,
    description: desc || undefined,
    startsAt,
    channelId: channel.id,
    messageId: sent.id,
  });

  // 3. Atualiza com botões funcionais
  const counts = await eventsStore.stats(saved.id);
  await sent.edit(eventPayload({ title, startsAt, description: desc, counts, eventId: saved.id }));

  await replyV2Notice(inter, `✅ Evento **${title}** criado com sucesso!`, true);
}

export async function handleRsvpClick(
  inter: ButtonInteraction,
  choice: RsvpChoice,
  eventId: string,
) {
  if (!inter.inCachedGuild()) return;

  const ev = await eventsStore.getById(eventId);
  if (!ev || ev.status !== 'scheduled') {
    await replyV2Notice(inter, '❌ Este evento não está mais ativo.', true);
    return;
  }

  // Registra RSVP
  await eventsStore.rsvp(eventId, inter.guildId!, inter.user.id, choice);

  // Atualiza painel
  const counts = await eventsStore.stats(eventId);
  try {
    const ch = inter.channel!;
    const msg = await (ch as GuildTextBasedChannel).messages.fetch(ev.messageId);
    await msg.edit(
      eventPayload({
        title: ev.title,
        startsAt: new Date(ev.startsAt),
        description: ev.description || undefined,
        counts,
        eventId: ev.id,
      }),
    );
  } catch {
    // ignore
  }

  const txt = choice === 'yes' ? 'Vou' : choice === 'maybe' ? 'Talvez' : 'Não vou';
  await replyV2Notice(inter, `✅ Presença confirmada: **${txt}**.`, true);
}
