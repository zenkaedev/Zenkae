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
  ChannelSelectMenuBuilder,
  ChannelType
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
  const footer = embed.data.footer?.text || '';
  const recurrenceMatch = footer.match(/Recurrence: (WEEKLY|NONE)/);
  const rewardMatch = footer.match(/Reward: (\d+)/);
  // Extract voice channel if stored in footer (we should store it there)
  const voiceMatch = footer.match(/Voice: (\d+)/);

  return {
    title: (embed.data.title || '').replace('📅 ', ''),
    description: desc.split('\n\n⏰')[0] || '', // Remove a parte do tempo
    startsAt,
    bannerUrl: embed.data.image?.url || null,
    recurrence: (recurrenceMatch ? recurrenceMatch[1] : 'NONE') as 'WEEKLY' | 'NONE',
    zkReward: rewardMatch ? parseInt(rewardMatch[1]) : 0,
    voiceChannelId: voiceMatch ? voiceMatch[1] : null,
  };
}

interface EventDraftData {
  title: string;
  description: string;
  startsAt: Date;
  bannerUrl: string | null;
  recurrence: 'WEEKLY' | 'NONE';
  zkReward: number;
  voiceChannelId?: string | null;
}

/**
 * Renderiza o painel de Draft (Preview + Controles)
 */
export function renderDraftPanel(data: EventDraftData) {
  const ts = Math.floor(data.startsAt.getTime() / 1000);
  const timeString = `<t:${ts}:F> (<t:${ts}:R>)`;
  const recurText = data.recurrence === 'WEEKLY' ? '🔄 Semanal' : 'Evento Único';
  const voiceText = data.voiceChannelId ? `<#${data.voiceChannelId}>` : 'Nenhum';

  // 1. O Embed de Preview (O que será postado)
  const embed = new EmbedBuilder()
    .setTitle(`📅 ${data.title}`)
    .setDescription(`${data.description ? data.description + '\n\n' : ''}⏰ **Quando:** ${timeString}`)
    .setColor(0x3d348b)
    .addFields(
      { name: '💎 Recompensa', value: `${data.zkReward} ZK`, inline: true },
      { name: '🔁 Recorrência', value: recurText, inline: true },
      { name: '🔊 Canal de Voz', value: voiceText, inline: true }
    )
    .setFooter({ text: `Preview Mode • Recurrence: ${data.recurrence} • Reward: ${data.zkReward} • Voice: ${data.voiceChannelId || ''}` }); // Metadata persistence

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

  // Channel Selector
  const rowSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('events:draft:select:voice')
      .setPlaceholder('🔊 Selecione o Canal de Voz (Opcional)')
      .setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('events:draft:publish').setLabel('✅ Publicar Evento').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('events:draft:cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
  );

  return { content: '🛠️ **Criador de Eventos** (Preview)', embeds: [embed], components: [row1, row2, rowSelect, row3], flags: MessageFlags.Ephemeral };
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

// --- Handlers (Edit, Toggle, Publish) ---

export async function handleDraftAction(inter: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | any) {
  // Reconstruct state from interaction message
  // If modal submit, the message is available via inter.message usually?
  // In Discord.js, ModalSubmitInteraction.message is available if the modal was shown from a component.
  // We will cast to any to allow flexibility in checking properties.

  const msg = inter.message;
  // If we don't have a message (e.g. command reply modal?), we can't edit preview. 
  // But our modals come from buttons on the preview message.
  if (!msg || !msg.embeds[0]) {
    // Try to recover? No.
    try { await inter.reply({ content: '❌ Erro: Preview perdido. Tente criar novamente.', flags: MessageFlags.Ephemeral }); } catch { }
    return;
  }

  // 1. Reconstruct Data
  let currentData = extractDataFromEmbed(EmbedBuilder.from(msg.embeds[0]));

  const customId = inter.customId;

  // --- HANDLERS ---

  // -> CANCEL
  if (customId === 'events:draft:cancel') {
    await inter.update({ content: '❌ Criação de evento cancelada.', embeds: [], components: [] });
    return;
  }

  // -> PUBLISH
  if (customId === 'events:draft:publish') {
    await inter.deferUpdate();

    const channel = inter.channel;
    if (!channel || !channel.isTextBased()) return; // Should not happen

    // Validate data?
    if (!currentData.bannerUrl) {
      // Optional warning? Nah.
    }

    // Save to DB
    const event = await eventsStore.create({
      guildId: inter.guildId!,
      title: currentData.title,
      description: currentData.description,
      startsAt: currentData.startsAt,
      channelId: channel.id, // Text channel where command was run
      messageId: 'pending',
      imageUrl: currentData.bannerUrl || undefined,
      zkReward: currentData.zkReward,
      recurrence: currentData.recurrence === 'NONE' ? undefined : 'WEEKLY',
      voiceChannelId: currentData.voiceChannelId || undefined
    });

    // Send real message
    const payload = eventPublicPayload(currentData, event.id);
    const sentInfo = await (channel as GuildTextBasedChannel).send(payload);

    // Update ID
    // @ts-ignore
    if (eventsStore.update) await eventsStore.update(event.id, { messageId: sentInfo.id });

    await inter.editReply({ content: '✅ **Evento Publicado com Sucesso!**', embeds: [], components: [] });
    return;
  }

  // -> TOGGLE RECURRENCE
  if (customId === 'events:draft:toggle:recur') {
    currentData.recurrence = currentData.recurrence === 'WEEKLY' ? 'NONE' : 'WEEKLY';
    // Safe update
    await (inter as any).update(renderDraftPanel(currentData));
    return;
  }

  // -> MODAL OPENERS
  if (customId === 'events:draft:edit:main') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:main').setTitle('Editar Detalhes');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setValue(currentData.title).setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição').setValue(currentData.description).setStyle(TextInputStyle.Paragraph).setRequired(false))
    );
    await inter.showModal(modal);
    return;
  }
  if (customId === 'events:draft:edit:time') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:time').setTitle('Data e Hora');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('datetime').setLabel('YYYY-MM-DD HH:mm').setPlaceholder('2025-12-31 20:00').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await inter.showModal(modal);
    return;
  }
  if (customId === 'events:draft:edit:image') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:image').setTitle('Banner do Evento');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL da Imagem').setValue(currentData.bannerUrl || '').setStyle(TextInputStyle.Short).setRequired(false))
    );
    await inter.showModal(modal);
    return;
  }
  if (customId === 'events:draft:edit:reward') {
    const modal = new ModalBuilder().setCustomId('events:draft:submit:reward').setTitle('Recompensa (ZK)');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Quantidade').setValue(currentData.zkReward.toString()).setStyle(TextInputStyle.Short).setRequired(true))
    );
    await inter.showModal(modal);
    return;
  }

  // -> CHANNEL SELECT
  if (customId === 'events:draft:select:voice') {
    if (inter.isChannelSelectMenu()) {
      const selected = inter.values[0];
      currentData.voiceChannelId = selected;
      await inter.update(renderDraftPanel(currentData) as any);
    }
    return;
  }

  // -> MODAL SUBMITS
  if (inter.isModalSubmit()) {
    // Process fields
    if (customId === 'events:draft:submit:main') {
      currentData.title = inter.fields.getTextInputValue('title');
      currentData.description = inter.fields.getTextInputValue('desc');
    }
    else if (customId === 'events:draft:submit:time') {
      const raw = inter.fields.getTextInputValue('datetime');
      const newDate = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + ':00');
      if (!isNaN(newDate.getTime())) currentData.startsAt = newDate;
    }
    else if (customId === 'events:draft:submit:image') {
      const url = inter.fields.getTextInputValue('url');
      currentData.bannerUrl = url.length > 5 ? url : null;
    }
    else if (customId === 'events:draft:submit:reward') {
      const amt = parseInt(inter.fields.getTextInputValue('amount'));
      if (!isNaN(amt) && amt >= 0) currentData.zkReward = amt;
    }

    // CRITICAL FIX: Use update() if available, otherwise just rely on editReply via update call?
    // ModalSubmitInteraction updates the message via update() method if it was spawned from a component.
    // We essentially just call update on the interaction with the new payload.

    await (inter as any).update(renderDraftPanel(currentData));
    return;
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
// --- Event Manager ---

export async function renderEventsManager(guildId: string): Promise<any> {
  const events = await eventsStore.listUpcoming(guildId, 25);

  // Select Menu for events
  const options = events.map(e => ({
    label: e.title.substring(0, 99),
    description: new Date(e.startsAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    value: e.id,
    emoji: '📅'
  }));

  const rows: ActionRowBuilder<any>[] = [];

  if (options.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('events:manager:select')
            .setPlaceholder('Selecione um evento para gerenciar')
            .addOptions(options)
        )
    );
  }

  // Controls
  const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('events:manager:refresh').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('events:manager:delete').setLabel('❌ Deletar Selecionado').setStyle(ButtonStyle.Danger).setDisabled(true) // Starts disabled
  );

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Gerenciador de Eventos')
    .setDescription(options.length > 0 ? `Encontrados **${options.length}** eventos agendados.` : 'Nenhum evento agendado encontrado.')
    .setColor(0x3d348b);

  return {
    embeds: [embed],
    components: [...rows, controls],
    flags: MessageFlags.Ephemeral
  };
}

export async function handleManagerAction(inter: ButtonInteraction | StringSelectMenuInteraction | any) {
  // This handler needs state. The selected event ID is usually not persisted in message state nicely unless we use the select menu's value.
  // For simplicity, we make "Delete" require selecting from the menu FIRST, which updates the message to enable the button with the ID encoded?
  // Or we use a specific approach: Select -> Updates Embed with Details + Enable Delete Button with ID in customId.

  if (inter.customId === 'events:manager:select') {
    const eventId = inter.values[0];
    const event = await eventsStore.getById(eventId);
    if (!event) {
      await inter.reply({ content: 'Evento não encontrado.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Gerenciando: ${event.title}`)
      .setDescription(event.description || 'Sem descrição')
      .addFields(
        { name: 'Data', value: new Date(event.startsAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), inline: true },
        { name: 'ID', value: `\`${event.id}\``, inline: true }
      )
      .setColor(0x3d348b);

    const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('events:manager:back').setLabel('🔙 Voltar a Lista').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`events:manager:delete:${event.id}`).setLabel('❌ Deletar Evento').setStyle(ButtonStyle.Danger)
    );

    await inter.update({ embeds: [embed], components: [controls] });
    return;
  }

  if (inter.customId.startsWith('events:manager:delete:')) {
    const eventId = inter.customId.split(':')[3];
    await eventsStore.delete(eventId);
    await inter.update({ content: '✅ Evento deletado.', embeds: [], components: [] });
    return;
  }

  if (inter.customId === 'events:manager:back' || inter.customId === 'events:manager:refresh') {
    const payload = await renderEventsManager(inter.guildId!);
    await inter.update(payload);
    return;
  }
}
