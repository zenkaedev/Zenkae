// src/modules/recruit/panel.ts
import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
} from 'discord.js';

import { recruitStore } from './store';
import { buildScreen, replyV2Notice } from '../../ui/v2';
import { ids } from '../../ui/ids';
import { buildApplicationCard } from './card';

/* -------------------------------------------------------
 * Painel público (Components V2)
 * ----------------------------------------------------- */
export function renderPublicRecruitPanel() {
  return buildScreen({
    title: 'Painel de Recrutamento',
    subtitle: 'Clique em **Quero entrar** para enviar seu nick e classe.',
    buttons: [{ id: ids.recruit.apply, label: 'Quero entrar' }],
  });
}

export async function handlePublishRecruitPanel(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
) {
  if (!interaction.inCachedGuild()) return;

  const settings = await recruitStore.getSettings(interaction.guildId!);
  const ch = interaction.channel;
  if (!ch?.isTextBased()) {
    await replyV2Notice(interaction, '❌ Use em um canal de texto da guilda.', true);
    return;
  }

  // Se houver canal fixo configurado, publica lá; senão, usa o canal atual
  const target =
    settings.panelChannelId
      ? await interaction.client.channels.fetch(settings.panelChannelId).catch(() => null)
      : ch;

  if (!target || !target.isTextBased()) {
    await replyV2Notice(
      interaction,
      '❌ Canal do painel inválido. Configure em **Recrutamento → Canal de Recrutamento**.',
      true,
    );
    return;
  }

  const payload = renderPublicRecruitPanel();
  const sent = await (target as GuildTextBasedChannel).send(payload);
  await recruitStore.setPanel(interaction.guildId!, {
    channelId: (sent.channel as any).id,
    messageId: sent.id,
  });

  await replyV2Notice(interaction, 'Painel de recrutamento publicado/atualizado.', true);
}

/* -------------------------------------------------------
 * Fluxo do candidato
 * ----------------------------------------------------- */
export async function openApplyModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('recruit:apply:modal')
    .setTitle('Aplicação — Recrutamento');

  const nick = new TextInputBuilder()
    .setCustomId('nick')
    .setLabel('Seu Nick (obrigatório)')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32);

  const klass = new TextInputBuilder()
    .setCustomId('class')
    .setLabel('Classe (ex.: Guerreiro, Mago...)')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nick),
    new ActionRowBuilder<TextInputBuilder>().addComponents(klass),
  );

  await interaction.showModal(modal);
}

export async function handleApplyModalSubmit(interaction: ModalSubmitInteraction) {
  if (!interaction.inCachedGuild()) return;

  const guildId = interaction.guildId!;
  const user = interaction.user;

  const nick = interaction.fields.getTextInputValue('nick').trim();
  const className = interaction.fields.getTextInputValue('class').trim();

  const existing = await recruitStore.findByUser(guildId, user.id);
  if (existing && existing.status === 'pending') {
    await replyV2Notice(interaction, '⚠️ Você já tem uma aplicação pendente.', true);
    return;
  }

  const app = await recruitStore.create({
    guildId,
    userId: user.id,
    username: user.username,
    nick,
    className,
  });

  // Perguntas personalizadas (armazenadas como string JSON em RecruitSettings.questions)
  const settings = await recruitStore.getSettings(guildId);
  const questions = recruitStore.parseQuestions(settings.questions).slice(0, 4);

  // Não é possível abrir um modal a partir de outro modal:
  // então enviamos um botão para o usuário abrir o 2º modal (Q&A)
  if (questions.length) {
    await replyV2Notice(interaction, 'Clique para responder às perguntas personalizadas.', true);
    await interaction.followUp({
      flags: 1 << 6, // Ephemeral
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              custom_id: ids.recruit.applyQOpen(app.id),
              label: 'Responder perguntas',
            },
          ],
        } as any,
      ],
    });
    return;
  }

  // Sem perguntas → publica cartão imediatamente
  await publishApplicationCard(interaction, app.id);
}

export async function openApplyQuestionsModal(inter: ButtonInteraction, appId: string) {
  const guildId = inter.guildId!;
  const s = await recruitStore.getSettings(guildId);
  const qs: string[] = recruitStore.parseQuestions(s.questions).slice(0, 4);

  const qModal = new ModalBuilder()
    .setCustomId(`recruit:apply:q:modal:${appId}`)
    .setTitle('Perguntas de Recrutamento');

  qs.forEach((q, idx) => {
    qModal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${idx + 1}`)
          .setLabel(q.slice(0, 45))
          .setRequired(false)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(300),
      ),
    );
  });

  await inter.showModal(qModal);
}

export async function handleApplyQuestionsSubmit(interaction: ModalSubmitInteraction, appId: string) {
  const answers: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const v = interaction.fields.getTextInputValue(`q${i}`) || '';
    if (v.trim()) answers.push(v.trim());
  }
  await recruitStore.setAnswers(appId, answers);
  await publishApplicationCard(interaction, appId);
}

async function publishApplicationCard(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  appId: string,
) {
  const app = await recruitStore.getById(appId);
  if (!app) {
    await replyV2Notice(interaction, '❌ Aplicação não encontrada.', true);
    return;
  }

  const settings = await recruitStore.getSettings(app.guildId);
  const targetId = settings.formsChannelId ?? interaction.channelId ?? undefined;
    if (!targetId) {
      await replyV2Notice(
        interaction,
        '❌ Configure o **Canal de formulário** em Recrutamento.',
        true,
      );
      return;
    }
  const target = await interaction.client.channels.fetch(targetId).catch(() => null);

  // monta o payload com Components V2 do card
  const cardPayload = await buildApplicationCard(interaction.client, app as any, {
    questions: recruitStore.parseQuestions(settings.questions),
    dmAcceptedTemplate: settings.dmAcceptedTemplate,
    dmRejectedTemplate: settings.dmRejectedTemplate,
  });

  const sent = await (target as GuildTextBasedChannel).send(cardPayload);
  await recruitStore.setCardRef(app.id, {
    channelId: (sent.channel as any).id,
    messageId: sent.id,
  });

  await replyV2Notice(
    interaction,
    '✅ Sua candidatura foi registrada! Aguarde retorno da staff.',
    true,
  );
}

/* -------------------------------------------------------
 * Configurações (Dashboard → Recruit)
 * ----------------------------------------------------- */
export function renderRecruitSettingsUI(
  s: Awaited<ReturnType<typeof recruitStore.getSettings>>,
) {
  const body =
    `**Editar formulário** → defina até 4 perguntas.\n` +
    `**Canal de Recrutamento** → canal fixo onde fica o painel público.\n` +
    `**Canal de formulário** → onde os cartões de aplicação serão publicados.\n` +
    `**Aparência** → título/descrição/imagem do painel público.\n` +
    `**DM Templates** → mensagens pré-definidas para aprovado/recusado.`;

  return buildScreen({
    title: 'Recrutamento — Configurações',
    subtitle:
      `Painel: ${s.panelChannelId ? `<#${s.panelChannelId}>` : '_não definido_'} · ` +
      `Formulários: ${s.formsChannelId ? `<#${s.formsChannelId}>` : '_não definido_'}`,
    body,
    buttons: [
      { id: ids.recruit.settingsForm, label: 'Editar formulário' },
      { id: ids.recruit.settingsPanelChannel, label: 'Canal de Recrutamento' },
      { id: ids.recruit.settingsFormsChannel, label: 'Canal de formulário' },
      { id: ids.recruit.settingsAppearance, label: 'Aparência' },
      { id: ids.recruit.settingsDM, label: 'DM Templates' },
    ],
    back: { id: 'dash:recruit', label: 'Voltar' },
  });
}

export async function openRecruitSettings(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);
  await inter.update(renderRecruitSettingsUI(s));
}

export async function openEditFormModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);
  const qs: string[] = recruitStore.parseQuestions(s.questions);

  const modal = new ModalBuilder()
    .setCustomId(ids.recruit.modalForm)
    .setTitle('Editar formulário (4 perguntas)');

  for (let i = 0; i < 4; i++) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${i + 1}`)
          .setLabel(`Pergunta ${i + 1}`)
          .setRequired(false)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setValue(qs[i] ?? ''),
      ),
    );
  }
  await inter.showModal(modal);
}

export async function handleEditFormSubmit(inter: ModalSubmitInteraction) {
  const qs = [1, 2, 3, 4]
    .map((i) => (inter.fields.getTextInputValue(`q${i}`) || '').trim())
    .filter(Boolean);
  await recruitStore.updateSettings(inter.guildId!, { questions: qs });
  await replyV2Notice(inter, '✅ Formulário atualizado.', true);
}

export async function openAppearanceModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);
  const modal = new ModalBuilder()
    .setCustomId(ids.recruit.modalAppearance)
    .setTitle('Aparência do Painel Público');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Título (opcional)')
        .setRequired(false)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setValue(s.appearanceTitle ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('desc')
        .setLabel('Descrição (opcional)')
        .setRequired(false)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setValue(s.appearanceDescription ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('image')
        .setLabel('Imagem (URL opcional)')
        .setRequired(false)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(200)
        .setValue(s.appearanceImageUrl ?? ''),
    ),
  );

  await inter.showModal(modal);
}

export async function handleAppearanceSubmit(inter: ModalSubmitInteraction) {
  await recruitStore.updateSettings(inter.guildId!, {
    appearanceTitle: (inter.fields.getTextInputValue('title') || '').trim() || null,
    appearanceDescription: (inter.fields.getTextInputValue('desc') || '').trim() || null,
    appearanceImageUrl: (inter.fields.getTextInputValue('image') || '').trim() || null,
  });
  await replyV2Notice(inter, '✅ Aparência atualizada.', true);
}

export async function openDMTemplatesModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);
  const modal = new ModalBuilder()
    .setCustomId(ids.recruit.modalDM)
    .setTitle('Templates de DM');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('ok')
        .setLabel('Aprovado (usa {reason} opcional)')
        .setRequired(false)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setValue(s.dmAcceptedTemplate ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('no')
        .setLabel('Recusado (usa {reason})')
        .setRequired(false)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setValue(s.dmRejectedTemplate ?? ''),
    ),
  );

  await inter.showModal(modal);
}

export async function handleDMTemplatesSubmit(inter: ModalSubmitInteraction) {
  await recruitStore.updateSettings(inter.guildId!, {
    dmAcceptedTemplate:
      (inter.fields.getTextInputValue('ok') || '').trim() || 'Parabéns! Você foi aprovado 🎉',
    dmRejectedTemplate:
      (inter.fields.getTextInputValue('no') || '').trim() ||
      'Obrigado por se inscrever. Infelizmente sua candidatura foi recusada. Motivo: {reason}',
  });
  await replyV2Notice(inter, '✅ Templates de DM atualizados.', true);
}

/* -------------------------------------------------------
 * Seleção de canais
 * ----------------------------------------------------- */
export async function openSelectPanelChannel(inter: ButtonInteraction) {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.recruit.selectPanelChannel)
    .setPlaceholder('Selecione o canal de Recrutamento (painel público)')
    .addChannelTypes(
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    );

  await inter.update(
    buildScreen({
      title: 'Escolha o canal de Recrutamento',
      subtitle: 'Canal onde o painel público será publicado/atualizado',
      body: '_Selecione abaixo_',
      selects: [menu],
      back: { id: 'dash:recruit', label: 'Voltar' },
    }),
  );
}

export async function openSelectFormsChannel(inter: ButtonInteraction) {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.recruit.selectFormsChannel)
    .setPlaceholder('Selecione o canal dos Formulários (aprovação)')
    .addChannelTypes(
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    );

  await inter.update(
    buildScreen({
      title: 'Escolha o canal de Formulários',
      subtitle: 'Cartões de candidatura serão publicados aqui',
      body: '_Selecione abaixo_',
      selects: [menu],
      back: { id: 'dash:recruit', label: 'Voltar' },
    }),
  );
}

export async function handleSelectChannel(inter: any, kind: 'panel' | 'forms') {
  const selId = (inter.values?.[0] as string | undefined) ?? undefined;
  if (!selId) {
    await replyV2Notice(inter, '❌ Selecione um canal.', true);
    return;
  }

  const data: any = {};
  if (kind === 'panel') data.panelChannelId = selId;
  if (kind === 'forms') data.formsChannelId = selId;

  await recruitStore.updateSettings(inter.guildId!, data);
  await replyV2Notice(inter, '✅ Canal salvo.', true);
}

/* -------------------------------------------------------
 * Decisão (aprovar / recusar)
 * ----------------------------------------------------- */
export async function handleDecisionApprove(inter: ButtonInteraction, appId: string) {
  const app = await recruitStore.updateStatus(appId, 'approved');
  await refreshCard(inter, appId);
  const s = await recruitStore.getSettings(app.guildId);
  const templ = s.dmAcceptedTemplate ?? 'Parabéns! Você foi aprovado 🎉';
  try {
    const u = await inter.client.users.fetch(app.userId);
    await u.send(templ);
  } catch {}
  await replyV2Notice(inter, '✅ Aplicação aprovada.', true);
}

export async function handleDecisionRejectOpen(inter: ButtonInteraction, appId: string) {
  const modal = new ModalBuilder()
    .setCustomId(ids.recruit.modalRejectReason(appId))
    .setTitle('Recusar — motivo (opcional)');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Motivo')
        .setRequired(false)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500),
    ),
  );
  await inter.showModal(modal);
}

export async function handleDecisionRejectSubmit(inter: ModalSubmitInteraction, appId: string) {
  const reason = (inter.fields.getTextInputValue('reason') || '').trim();
  const app = await recruitStore.updateStatus(appId, 'rejected', reason || null);
  await refreshCard(inter, appId);

  const s = await recruitStore.getSettings(app.guildId);
  const templ = (s.dmRejectedTemplate ?? 'Sua candidatura foi recusada. Motivo: {reason}').replaceAll(
    '{reason}',
    reason || '—',
  );
  try {
    const u = await inter.client.users.fetch(app.userId);
    await u.send(templ);
  } catch {}
  await replyV2Notice(inter, '✅ Aplicação recusada.', true);
}

/* -------------------------------------------------------
 * Atualização do cartão
 * ----------------------------------------------------- */
async function refreshCard(inter: ButtonInteraction | ModalSubmitInteraction, appId: string) {
  const app = await recruitStore.getById(appId);
  if (!app?.channelId || !app?.messageId) return;

  const ch = await inter.client.channels.fetch(app.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;

  const msg = await (ch as GuildTextBasedChannel).messages.fetch(app.messageId).catch(() => null);
  if (!msg) return;

  const s = await recruitStore.getSettings(app.guildId);
  const card = await buildApplicationCard(inter.client, app as any, {
    questions: recruitStore.parseQuestions(s.questions),
    dmAcceptedTemplate: s.dmAcceptedTemplate,
    dmRejectedTemplate: s.dmRejectedTemplate,
  });

  await msg.edit(card);
}
