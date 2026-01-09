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
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';

import { eventsStore } from './store.js';
import { replyV2Notice } from '../../ui/v2.js';

/**
 * Helper: Extrai dados do Embed de Preview para manter o estado "stateless"
 */
function extractDataFromEmbed(embed: EmbedBuilder): EventDraftData {
  const desc = embed.data.description || '';

  // Extrair timestamp do description <t:1234567890:F>
  const timeMatch = desc.match(/<t:(\d+):F>/);
  const startsAt = timeMatch ? new Date(parseInt(timeMatch[1]) * 1000) : new Date();

  // Extrair recorrência do footer ou fields? Vamos usar fields invisíveis ou footer
  // Hack: Armazenar metadados no footer text de forma discreta ou usar um campo
  // Vamos usar o footer text para persistir configs que não aparecem no body principal
  const footer = embed.data.footer?.text || '';
  const recurrenceMatch = footer.match(/Recurrence: (WEEKLY|NONE)/);
  const rewardMatch = footer.match(/Reward: (\d+)/);

  return {
    title: (embed.data.title || '').replace('📅 ', ''),
    description: desc.split('\n\n⏰')[0] || '', // Remove a parte do tempo
    startsAt,
    bannerUrl: embed.data.image?.url || null,
    recurrence: (recurrenceMatch ? recurrenceMatch[1] : 'NONE') as 'WEEKLY' | 'NONE',
    zkReward: rewardMatch ? parseInt(rewardMatch[1]) : 0,
  };
}

interface EventDraftData {
  title: string;
  description: string;
  startsAt: Date;
  bannerUrl: string | null;
  recurrence: 'WEEKLY' | 'NONE';
  zkReward: number;
}

/**
 * Renderiza o painel de Draft (Preview + Controles)
 */
export function renderDraftPanel(data: EventDraftData) {
  const ts = Math.floor(data.startsAt.getTime() / 1000);
  const timeString = `<t:${ts}:F> (<t:${ts}:R>)`;
  const recurText = data.recurrence === 'WEEKLY' ? '🔄 Semanal' : 'Evento Único';

  // 1. O Embed de Preview (O que será postado)
  const embed = new EmbedBuilder()
    .setTitle(`📅 ${data.title}`)
    .setDescription(`${data.description ? data.description + '\n\n' : ''}⏰ **Quando:** ${timeString}`)
    .setColor(0x3d348b)
    .addFields(
      { name: '💎 Recompensa', value: `${data.zkReward} ZK`, inline: true },
      { name: '🔁 Recorrência', value: recurText, inline: true }
    )
    .setFooter({ text: `Preview Mode • Recurrence: ${data.recurrence} • Reward: ${data.zkReward}` }); // Metadata persistence

  if (data.bannerUrl) embed.setImage(data.bannerUrl);

  // 2. Controles de Edição
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('events:draft:edit:main').setLabel('📝 Editar Texto').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('events:draft:edit:time').setLabel('📅 Mudar Data').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('events:draft:edit:image').setLabel('🖼️ Banner').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('events:draft:toggle:recur').setLabel(data.recurrence === 'WEEKLY' ? 'Desativar Repetição' : 'Ativar Repetição Semanal').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('events:draft:edit:reward').setLabel(`💎 Recompensa (${data.zkReward})`).setStyle(ButtonStyle.Primary),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('events:draft:publish').setLabel('✅ Publicar Evento').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('events:draft:cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
  );

  return { content: '🛠️ **Criador de Eventos** (Preview)', embeds: [embed], components: [row1, row2, row3], flags: MessageFlags.Ephemeral };
}

/**
 * Payload final para o canal público
 */
export function eventPublicPayload(data: EventDraftData, eventId: string) {
  const ts = Math.floor(data.startsAt.getTime() / 1000);
  const timeString = `<t:${ts}:F> (<t:${ts}:R>)`;

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${data.title}`)
    .setDescription(`${data.description ? data.description + '\n\n' : ''}⏰ **Quando:** ${timeString}`)
    .setColor(0x3d348b);

  if (data.bannerUrl) embed.setImage(data.bannerUrl);

  // Mostra recompensa se > 0
  if (data.zkReward > 0) {
    embed.addFields({ name: '💎 Recompensa', value: `${data.zkReward} ZK por participar`, inline: true });
  }

  if (data.recurrence === 'WEEKLY') {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayName = days[data.startsAt.getDay()];
    embed.setFooter({ text: `🔄 Este evento se repete toda(o) ${dayName}` });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`event:rsvp:yes:${eventId}`).setLabel('Vou').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`event:rsvp:maybe:${eventId}`).setLabel('Talvez').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`event:rsvp:no:${eventId}`).setLabel('Não vou').setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}


// --- Entry Point ---

export async function openNewEventModal(inter: ButtonInteraction) {
  // Inicia com um draft padrão
  const defaultData: EventDraftData = {
    title: 'Novo Evento',
    description: 'Descrição do evento aqui...',
    startsAt: new Date(Date.now() + 3600000), // +1h
    bannerUrl: null,
    recurrence: 'NONE',
    zkReward: 10
  };

  await inter.reply(renderDraftPanel(defaultData) as any);
}

// --- Handlers (Edit, Toggle, Publish) ---

export async function handleDraftAction(inter: ButtonInteraction | ModalSubmitInteraction) {
  // Se for modal submit, recuperamos o embed da mensagem original
  const msg = inter.message;
  if (!msg || !msg.embeds[0]) {
    return replyV2Notice(inter, '❌ Erro: Preview perdido.', true);
  }

  // Reconstruir estado atual
  let currentData = extractDataFromEmbed(EmbedBuilder.from(msg.embeds[0]));

  const customId = inter.customId;

  // 1. Modals Openers
  if (customId === 'events:draft:edit:main') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:main').setTitle('Editar Detalhes');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setValue(currentData.title).setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição').setValue(currentData.description).setStyle(TextInputStyle.Paragraph).setRequired(false))
    );
    if (inter.isButton()) await inter.showModal(modal);
    return;
  }

  if (customId === 'events:draft:edit:time') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:time').setTitle('Data e Hora');
    // Pre-fill é chato com datas, vamos deixar vazio ou tentar formatar
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('datetime').setLabel('YYYY-MM-DD HH:mm').setPlaceholder('2025-12-31 20:00').setStyle(TextInputStyle.Short).setRequired(true))
    );
    if (inter.isButton()) await inter.showModal(modal);
    return;
  }

  if (customId === 'events:draft:edit:image') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:image').setTitle('Banner do Evento');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL da Imagem').setValue(currentData.bannerUrl || '').setStyle(TextInputStyle.Short).setRequired(false))
    );
    if (inter.isButton()) await inter.showModal(modal);
    return;
  }

  if (customId === 'events:draft:edit:reward') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:reward').setTitle('Recompensa (ZK)');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Quantidade').setValue(currentData.zkReward.toString()).setStyle(TextInputStyle.Short).setRequired(true))
    );
    if (inter.isButton()) await inter.showModal(modal);
    return;
  }

  // 2. Toggles (Direct Updates)
  if (customId === 'events:draft:toggle:recur') {
    currentData.recurrence = currentData.recurrence === 'WEEKLY' ? 'NONE' : 'WEEKLY';
    if (inter.isButton()) await inter.update(renderDraftPanel(currentData) as any);
    return;
  }

  if (customId === 'events:draft:cancel') {
    if (inter.isButton()) await inter.update({ content: '❌ Criação de evento cancelada.', embeds: [], components: [] });
    return;
  }

  // 3. Modal Submits (Update Data)
  if (inter.isModalSubmit()) {
    // Modal submit cannot direct "update" the message unless it's a component modal... which discord.js types poorly.
    // We defer update to key "update" ability on the original message if possible
    await inter.deferUpdate();

    if (customId === 'events:draft:submit:main') {
      currentData.title = inter.fields.getTextInputValue('title');
      currentData.description = inter.fields.getTextInputValue('desc');
    }
    else if (customId === 'events:draft:submit:time') {
      const raw = inter.fields.getTextInputValue('datetime');
      const newDate = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + ':00'); // Tenta parsear
      if (!isNaN(newDate.getTime())) {
        currentData.startsAt = newDate;
      }
    }
    else if (customId === 'events:draft:submit:image') {
      const url = inter.fields.getTextInputValue('url');
      currentData.bannerUrl = url.length > 5 ? url : null;
    }
    else if (customId === 'events:draft:submit:reward') {
      const amt = parseInt(inter.fields.getTextInputValue('amount'));
      if (!isNaN(amt) && amt >= 0) currentData.zkReward = amt;
    }

    // Now edit the original message
    if (msg) await msg.edit(renderDraftPanel(currentData) as any);
    return;
  }

  // 4. Publish
  if (customId === 'events:draft:publish') {
    if (!inter.isButton()) return;
    await inter.deferUpdate();

    const channel = inter.channel;
    if (!channel || !channel.isTextBased()) return;

    // Save to DB
    const event = await eventsStore.create({
      guildId: inter.guildId!,
      title: currentData.title,
      description: currentData.description,
      startsAt: currentData.startsAt,
      channelId: channel.id,
      messageId: 'pending',
      imageUrl: currentData.bannerUrl || undefined,
      zkReward: currentData.zkReward,
      recurrence: currentData.recurrence === 'NONE' ? undefined : 'WEEKLY'
    });

    // Send real message
    const payload = eventPublicPayload(currentData, event.id);
    const sentInfo = await (channel as GuildTextBasedChannel).send(payload);

    // Update ID
    // @ts-ignore
    if (eventsStore.update) await eventsStore.update(event.id, { messageId: sentInfo.id });

    await inter.editReply({ content: '✅ **Evento Publicado com Sucesso!**', embeds: [], components: [] });
  }
}


export async function handleRsvpClick(
  inter: ButtonInteraction,
  action: string,
  eventId: string,
) {
  if (!inter.inCachedGuild()) return;

  // customId: event:rsvp:<yes|maybe|no>:<eventId>

  if (!eventId) return;

  // Simple ephemeral feedback first
  await inter.deferReply({ flags: MessageFlags.Ephemeral });

  const statusMap: Record<string, 'yes' | 'maybe' | 'no'> = { yes: 'yes', maybe: 'maybe', no: 'no' };
  const status = statusMap[action];

  if (status) {
    const { rsvpChoiceToEnum } = await import('../../services/events/rsvp.js'); // Ensure we reuse the enum helper or just use string
    await eventsStore.rsvp(eventId, inter.guildId!, inter.user.id, status);
  }

  // Update the message counts
  const counts = await eventsStore.stats(eventId);
  const event = await eventsStore.getById(eventId);

  if (event && event.channelId && event.messageId) {
    try {
      const ch = await inter.client.channels.fetch(event.channelId);
      if (ch?.isTextBased()) {
        const msg = await (ch as GuildTextBasedChannel).messages.fetch(event.messageId);
        if (msg) {
          // Reconstruct payload carefully preserving original data
          const oldEmbed = msg.embeds[0];
          const bannerUrl = oldEmbed?.image?.url;

          // We need to parse footer/fields to get recurrence/reward back if we want to display them again
          // Or we can just fetch from DB event object

          const draftData: EventDraftData = {
            title: event.title,
            description: event.description || '',
            startsAt: new Date(event.startsAt),
            bannerUrl: event.imageUrl || bannerUrl || null,
            recurrence: (event.recurrence as 'WEEKLY' | 'NONE') || 'NONE',
            zkReward: event.zkReward
          };

          // Add counts info? eventPublicPayload doesn't have counts in fields by default in my new version?
          // Actually my new eventPublicPayload logic DID NOT include counts field. Users want to see counts.
          // Let's add counts to footer or a field update.

          const payload = eventPublicPayload(draftData, eventId);
          // Add counts field dynamically
          const embed = EmbedBuilder.from(payload.embeds[0]);
          embed.addFields({
            name: 'Participantes',
            value: `✅ ${counts.yes}  ❔ ${counts.maybe}  ❌ ${counts.no}`,
            inline: false
          });

          await msg.edit({ embeds: [embed], components: payload.components });
        }
      }
    } catch (e) {
      console.error('Failed to update event message', e);
    }
  }

  await inter.editReply(`✅ Presença confirmada: **${action.toUpperCase()}**`);
}
