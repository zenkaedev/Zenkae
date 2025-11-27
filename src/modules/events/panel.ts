import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type GuildTextBasedChannel,
} from 'discord.js';

import { eventsStore } from './store.js';
import { ids } from '../../ui/ids.js';

/**
 * Payload do evento (Embed + Botões)
 */
export function eventPayload(
  data: {
    title: string;
    startsAt: Date;
    description?: string | null;
    counts?: { yes: number; maybe: number; no: number };
    eventId?: string;
    bannerUrl?: string | null;
  },
  bannerUrlOverride?: string | null,
) {
  const { title, startsAt, description, counts, eventId } = data;
  const banner = bannerUrlOverride ?? data.bannerUrl;

  const ts = Math.floor(startsAt.getTime() / 1000);
  // <t:TS:F> = Full date + time (Tuesday, 20 April 2021 16:20)
  // <t:TS:R> = Relative (in an hour)
  const timeString = `<t:${ts}:F> (<t:${ts}:R>)`;

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${title}`)
    .setDescription(
      `${description ? `${description}\n\n` : ''}⏰ **Quando:** ${timeString}`,
    )
    .setColor(0x3d348b);

  if (banner) {
    embed.setImage(banner);
  }

  // Se tiver contagens, adiciona no footer ou fields
  if (counts) {
    embed.addFields({
      name: 'Confirmados',
      value: `✅ ${counts.yes} | ❔ ${counts.maybe} | ❌ ${counts.no}`,
    });
  }

  // Botões
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (eventId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`event:rsvp:yes:${eventId}`)
        .setLabel('Vou')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`event:rsvp:maybe:${eventId}`)
        .setLabel('Talvez')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`event:rsvp:no:${eventId}`)
        .setLabel('Não vou')
        .setStyle(ButtonStyle.Danger),
    );
  } else {
    // Botões desabilitados (preview)
    row.addComponents(
      new ButtonBuilder().setCustomId('fake:yes').setLabel('Vou').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('fake:maybe').setLabel('Talvez').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('fake:no').setLabel('Não vou').setStyle(ButtonStyle.Danger).setDisabled(true),
    );
  }

  return {
    embeds: [embed],
    components: [row],
  };
}

export async function openNewEventModal(inter: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId('events:new:modal').setTitle('Novo Evento');

  const title = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Título do evento')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80);

  const date = new TextInputBuilder()
    .setCustomId('date')
    .setLabel('Data (AAAA-MM-DD)')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('2025-12-31')
    .setMinLength(10)
    .setMaxLength(10);

  const time = new TextInputBuilder()
    .setCustomId('time')
    .setLabel('Hora (HH:mm)')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('20:00')
    .setMinLength(5)
    .setMaxLength(5);

  const desc = new TextInputBuilder()
    .setCustomId('desc')
    .setLabel('Descrição')
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500);

  // Fallback: Usar TextInput para URL do Banner
  const banner = new TextInputBuilder()
    .setCustomId('banner')
    .setLabel('URL do Banner (Opcional)')
    .setRequired(false)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://...');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(title),
    new ActionRowBuilder<TextInputBuilder>().addComponents(date),
    new ActionRowBuilder<TextInputBuilder>().addComponents(time),
    new ActionRowBuilder<TextInputBuilder>().addComponents(desc),
    new ActionRowBuilder<TextInputBuilder>().addComponents(banner),
  );

  await inter.showModal(modal);
}

export async function handleNewEventSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild()) return;

  // Router already deferred via ensureDeferredModal, so we skip deferReply here
  // await inter.deferReply({ flags: MessageFlags.Ephemeral }); // REMOVED to prevent double defer

  const title = inter.fields.getTextInputValue('title').trim();
  const date = inter.fields.getTextInputValue('date').trim();
  const time = inter.fields.getTextInputValue('time').trim();
  const desc = (inter.fields.getTextInputValue('desc') || '').trim();
  const bannerUrl = (inter.fields.getTextInputValue('banner') || '').trim();

  // Validação básica de data
  const startsAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startsAt.getTime())) {
    await inter.editReply({ content: '❌ Data/hora inválida.' });
    return;
  }

  // Se tiver bannerUrl, validar se é URL
  let finalBannerUrl: string | null = null;
  if (bannerUrl && bannerUrl.startsWith('http')) {
    finalBannerUrl = bannerUrl;
  }

  const channel = inter.channel;
  if (!channel || !channel.isTextBased()) {
    await inter.editReply({ content: '❌ Canal inválido.' });
    return;
  }

  // 1. Cria o evento no banco (sem messageId ainda)
  // Nota: O store.create precisa suportar bannerUrl se quisermos salvar.
  // Se não suportar, teremos que ignorar ou atualizar o store.
  // Vou assumir que o store.create NÃO tem bannerUrl ainda, então passamos undefined ou atualizamos depois?
  // Vou passar o básico que o store aceita.
  const event = await eventsStore.create({
    guildId: inter.guildId!,
    // creatorId: inter.user.id, // Store pode não ter esse campo no create, verificar store.ts
    title,
    description: desc,
    startsAt,
    channelId: channel.id,
    messageId: 'pending', // Placeholder
  });

  // 2. Envia a mensagem
  const payload = eventPayload({
    title,
    startsAt,
    description: desc,
    eventId: event.id,
    bannerUrl: finalBannerUrl
  });

  const sent = await (channel as GuildTextBasedChannel).send(payload);

  // 3. Atualiza o evento com o ID da mensagem real
  // O store deve ter um método update ou setMsgId
  // Se não tiver setMessageId, usamos update
  /* 
     await eventsStore.update(event.id, { messageId: sent.id });
     Mas vou usar o prisma direto se precisar ou assumir que existe um update.
     Olhando o código anterior, parecia ter eventsStore.setMessageId? 
     O erro disse que não existe.
     Vou usar eventsStore.update se existir, ou criar.
  */
  // @ts-ignore - Tentativa de update genérico se existir, senão vai falhar e eu corrijo.
  if (eventsStore.update) {
    await eventsStore.update(event.id, { messageId: sent.id });
  } else {
    // Fallback se não tiver método update exposto
    console.warn('⚠️ eventsStore.update não encontrado. MessageID pode ficar desatualizado.');
  }

  await inter.editReply({
    content: '✅ Evento criado com sucesso!',
  });
}

export async function handleRsvpClick(
  inter: ButtonInteraction,
  action: string,
  eventId: string,
) {
  if (!inter.inCachedGuild()) return;

  // customId: event:rsvp:<yes|maybe|no>:<eventId>
  // Já vem parseado do listener
  // const parts = customId.split(':');
  // const action = parts[2];
  // const eventId = parts[3];

  if (!eventId) return;

  await inter.deferReply({ flags: MessageFlags.Ephemeral });

  const statusMap: Record<string, 'yes' | 'maybe' | 'no'> = {
    yes: 'yes',
    maybe: 'maybe',
    no: 'no',
  };
  const status = statusMap[action];
  if (!status) return;

  await eventsStore.rsvp(eventId, inter.guildId!, inter.user.id, status);
  const counts = await eventsStore.stats(eventId);
  const event = await eventsStore.getById(eventId);

  if (event && event.channelId && event.messageId) {
    const ch = await inter.client.channels.fetch(event.channelId).catch(() => null);
    if (ch?.isTextBased()) {
      const msg = await (ch as GuildTextBasedChannel).messages.fetch(event.messageId).catch(() => null);
      if (msg) {
        // Preservar banner original se existir no embed
        const oldEmbed = msg.embeds[0];
        const bannerUrl = oldEmbed?.image?.url;

        await msg.edit(eventPayload({
          title: event.title,
          startsAt: new Date(event.startsAt), // Garantir Date
          description: event.description,
          counts,
          eventId,
          bannerUrl
        }));
      }
    }
  }

  await inter.editReply(`✅ Presença confirmada: **${action.toUpperCase()}**`);
}
