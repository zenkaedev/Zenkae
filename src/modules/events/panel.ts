import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  FileUploadBuilder,
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
  bannerUrl?: string | null;
}) {
  const { title, startsAt, description, counts, eventId, bannerUrl } = params;
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

  if (bannerUrl) {
    embed.setImage(bannerUrl);
  }

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

  // NOVO: File Upload para Banner
  // Nota: FileUploadBuilder não tem setLabel, ele é apenas o arquivo.
  // Para adicionar em ActionRow, usamos ActionRowBuilder<FileUploadBuilder>
  const banner = new FileUploadBuilder()
    .setCustomId('banner')
    .setRequired(false);
  // .setMaxFiles(1); // Removido pois parece não existir no builder ainda

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(title),
    new ActionRowBuilder<TextInputBuilder>().addComponents(date),
    new ActionRowBuilder<TextInputBuilder>().addComponents(time),
    new ActionRowBuilder<TextInputBuilder>().addComponents(desc),
    new ActionRowBuilder<any>().addComponents(banner), // Cast para any para evitar erro de tipo
  );

  await inter.showModal(modal);
}

export async function handleNewEventSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild()) return;

  const title = inter.fields.getTextInputValue('title').trim();
  const date = inter.fields.getTextInputValue('date').trim();
  const time = inter.fields.getTextInputValue('time').trim();
  const desc = (inter.fields.getTextInputValue('desc') || '').trim();

  // Recuperar arquivo (banner)
  // @ts-ignore
  const files = inter.fields.getUploadedFiles ? inter.fields.getUploadedFiles('banner') : null;
  const bannerAttachment = files && files.size > 0 ? files.first() : null;

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
  const payloadFiles = bannerAttachment ? [bannerAttachment] : [];
  const bannerUrl = bannerAttachment ? `attachment://${bannerAttachment.name}` : undefined;

  const payload = eventPayload({ title, startsAt, description: desc, eventId: undefined, bannerUrl });

  const sent = await (channel as GuildTextBasedChannel).send({
    ...payload,
    files: payloadFiles
  });

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
  await sent.edit(eventPayload({ title, startsAt, description: desc, counts, eventId: saved.id, bannerUrl }));

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

    // Tenta recuperar a URL da imagem se existir no embed atual
    const currentEmbed = msg.embeds[0];
    const bannerUrl = currentEmbed?.image?.url;

    await msg.edit(
      eventPayload({
        title: ev.title,
        startsAt: new Date(ev.startsAt),
        description: ev.description || undefined,
        counts,
        eventId: ev.id,
        bannerUrl, // Mantém a imagem se existir
      }),
    );
  } catch {
    // ignore
  }

  const txt = choice === 'yes' ? 'Vou' : choice === 'maybe' ? 'Talvez' : 'Não vou';
  await replyV2Notice(inter, `✅ Presença confirmada: **${txt}**.`, true);
}
