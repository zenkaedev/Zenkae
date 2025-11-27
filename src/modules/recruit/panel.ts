// src/modules/recruit/panel.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type ChannelSelectMenuInteraction,
  type RoleSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
  MessageFlags,
} from 'discord.js';

import { recruitStore } from './store.js';
import { ids } from '../../ui/ids.js';
import { publishPublicRecruitPanelV2 } from '../../ui/recruit/panel.public.js';

/* --------------------------------------------------------------------------------
   Painel de Controle (Staff)
   - Exibe status do recrutamento
   - Botões para configurar: Classes, Perguntas, Aparência, Templates, Canais
-------------------------------------------------------------------------------- */

async function ack(inter: { deferReply: (o: any) => Promise<any> }, opts?: any) {
  await inter.deferReply(opts);
}

async function notice(inter: any, content: string, ephemeral = true) {
  if (inter.replied || inter.deferred) {
    await inter.followUp({ content, flags: ephemeral ? MessageFlags.Ephemeral : undefined });
  } else {
    await inter.reply({ content, flags: ephemeral ? MessageFlags.Ephemeral : undefined });
  }
}

export async function renderRecruitPanel(guildId: string) {
  const s = await recruitStore.getSettings(guildId);

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Painel de Recrutamento')
    .setDescription(
      `Configure aqui as opções de recrutamento do servidor.\n\n` +
      `**Status**: ${s.enabled ? '🟢 Ativo' : '🔴 Desativado'}\n` +
      `**Canal do Painel Público**: ${s.panelChannelId ? `<#${s.panelChannelId}>` : 'Não definido'}\n` +
      `**Canal de Formulários (Staff)**: ${s.formsChannelId ? `<#${s.formsChannelId}>` : 'Não definido'}\n` +
      `**Classes**: ${s.classes.length} configuradas\n` +
      `**Perguntas**: ${s.questions.length} definidas`,
    )
    .setColor(0x2b2d31);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.recruit.settings.classes)
      .setLabel('Classes')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🛡️'),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settings.questions)
      .setLabel('Perguntas')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📝'),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settings.appearance)
      .setLabel('Aparência')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎨'),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settings.templates)
      .setLabel('Templates DM')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📨'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.recruit.settings.setChannelPanel)
      .setLabel('Canal Painel')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settings.setChannelForms)
      .setLabel('Canal Forms')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ids.recruit.publish)
      .setLabel('Publicar Painel')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀'),
  );

  return { embeds: [embed], components: [row1, row2] };
}

/* ---------------- Handlers ---------------- */

export async function handlePublishRecruitPanel(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
) {
  await ack(interaction, { flags: MessageFlags.Ephemeral });
  return publishPublicRecruitPanelV2(interaction);
}

export async function handleRecruitSettingsButton(
  interaction: ButtonInteraction,
  sub: string,
) {
  // sub: classes, questions, appearance, templates, setChannelPanel, setChannelForms
  if (sub === 'classes') {
    // Redireciona para UI de classes (outro arquivo ou modal)
    // Por simplicidade, vou abrir um modal de edição rápida ou menu
    // Mas classes é complexo. Vamos focar no básico.
    await notice(interaction, '⚙️ Configuração de classes via comando `/recruit classes` (em breve).', true);
  } else if (sub === 'questions') {
    await openQuestionsModal(interaction);
  } else if (sub === 'appearance') {
    await openAppearanceModal(interaction);
  } else if (sub === 'templates') {
    await openDMTemplatesModal(interaction);
  } else if (sub === 'setChannelPanel') {
    await openChannelSelect(interaction, 'panel');
  } else if (sub === 'setChannelForms') {
    await openChannelSelect(interaction, 'forms');
  }
}

/* ---------------- Modais de Configuração ---------------- */

async function openQuestionsModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);
  const qs = recruitStore.parseQuestions(s.questions);

  const modal = new ModalBuilder()
    .setCustomId('recruit:settings:questions:modal')
    .setTitle('Editar Perguntas');

  // Discord limita a 5 inputs. Vamos permitir editar as 4 primeiras + 1 extra?
  // Ou apenas as 5 primeiras.
  for (let i = 0; i < 5; i++) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${i + 1}`)
          .setLabel(`Pergunta ${i + 1}`)
          .setValue(qs[i] || '')
          .setRequired(false)
          .setStyle(TextInputStyle.Paragraph),
      ),
    );
  }

  await inter.showModal(modal);
}

export async function handleEditFormSubmit(inter: ModalSubmitInteraction) {
  await ack(inter, { flags: MessageFlags.Ephemeral });
  const qs = [1, 2, 3, 4, 5]
    .map((i) => ((inter as any).fields.getTextInputValue(`q${i}`) || '').trim())
    .filter(Boolean);

  await recruitStore.updateSettings(inter.guildId!, {
    questions: JSON.stringify(qs),
  });

  await notice(inter, '✅ Perguntas atualizadas!', true);
}

async function openAppearanceModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);

  const modal = new ModalBuilder()
    .setCustomId('recruit:settings:appearance:modal')
    .setTitle('Aparência do Painel');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Título')
        .setValue(s.appearanceTitle || 'Recrutamento')
        .setRequired(true)
        .setStyle(TextInputStyle.Short),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('desc')
        .setLabel('Descrição')
        .setValue(s.appearanceDescription || '')
        .setRequired(false)
        .setStyle(TextInputStyle.Paragraph),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('img')
        .setLabel('URL da Imagem (Banner)')
        .setValue(s.appearanceImageUrl || '')
        .setRequired(false)
        .setStyle(TextInputStyle.Short),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('thumb')
        .setLabel('URL da Thumbnail (Pequena)')
        .setValue(s.appearanceThumbUrl || '')
        .setRequired(false)
        .setStyle(TextInputStyle.Short),
    ),
  );

  await inter.showModal(modal);
}

export async function handleAppearanceSubmit(inter: ModalSubmitInteraction) {
  await ack(inter, { flags: MessageFlags.Ephemeral });
  await recruitStore.updateSettings(inter.guildId!, {
    appearanceTitle: ((inter as any).fields.getTextInputValue('title') || '').trim() || null,
    appearanceDescription: ((inter as any).fields.getTextInputValue('desc') || '').trim() || null,
    appearanceImageUrl: ((inter as any).fields.getTextInputValue('img') || '').trim() || null,
    appearanceThumbUrl: ((inter as any).fields.getTextInputValue('thumb') || '').trim() || null,
  });
  await notice(inter, '✅ Aparência atualizada!', true);
}

async function openDMTemplatesModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);

  const modal = new ModalBuilder()
    .setCustomId('recruit:settings:templates:modal')
    .setTitle('Templates de DM');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('ok')
        .setLabel('Mensagem de Aprovação')
        .setValue(s.dmAcceptedTemplate || 'Parabéns! Você foi aprovado.')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('nok')
        .setLabel('Mensagem de Reprovação')
        .setValue(s.dmRejectedTemplate || 'Infelizmente você não foi aprovado.')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph),
    ),
  );

  await inter.showModal(modal);
}

export async function handleDMTemplatesSubmit(inter: ModalSubmitInteraction) {
  await ack(inter, { flags: MessageFlags.Ephemeral });
  await recruitStore.updateSettings(inter.guildId!, {
    dmAcceptedTemplate:
      ((inter as any).fields.getTextInputValue('ok') || '').trim() ||
      'Parabéns! Você foi aprovado.',
    dmRejectedTemplate:
      ((inter as any).fields.getTextInputValue('nok') || '').trim() ||
      'Infelizmente você não foi aprovado.',
  });
  await notice(inter, '✅ Templates atualizados!', true);
}

async function openChannelSelect(inter: ButtonInteraction, kind: 'panel' | 'forms') {
  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`recruit:settings:channel:${kind}`)
      .setPlaceholder('Selecione o canal')
      .setChannelTypes(ChannelType.GuildText),
  );

  await inter.reply({
    content: `Selecione o canal para **${kind === 'panel' ? 'Painel Público' : 'Formulários (Staff)'}**:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleSelectChannel(inter: any, kind: 'panel' | 'forms') {
  await ack(inter as ButtonInteraction, { flags: MessageFlags.Ephemeral });
  const selId = (inter.values?.[0] as string | undefined) ?? undefined;
  if (!selId) {
    await notice(inter, '❌ Selecione um canal.', true);
    return;
  }

  if (kind === 'panel') {
    await recruitStore.updateSettings(inter.guildId!, { panelChannelId: selId });
  } else {
    await recruitStore.updateSettings(inter.guildId!, { formsChannelId: selId });
  }

  await notice(inter, `✅ Canal de **${kind}** atualizado para <#${selId}>.`, true);
}

/* ---------------- Handlers de Decisão (Aprovar/Reprovar) ---------------- */

const processing = new Set<string>();

export async function handleDecisionClick(inter: ButtonInteraction, action: 'approve' | 'reject', appId: string) {
  const k = `${inter.user.id}:${appId}`;
  if (processing.has(k)) return;
  processing.add(k);

  try {
    if (action === 'reject') {
      // Abre modal de motivo
      const modal = new ModalBuilder()
        .setCustomId(`recruit:decision:reject:${appId}`)
        .setTitle('Motivo da Reprovação');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Motivo (enviado na DM)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      );

      await inter.showModal(modal);
    } else {
      // Aprovar direto
      await ack(inter, { flags: MessageFlags.Ephemeral });

      const approverDisplay =
        (inter.member && 'displayName' in inter.member ? (inter.member as any).displayName : null) ??
        inter.user.username;

      await recruitStore.setStatus(appId, 'approved', inter.user.id);

      // Tentar enviar DM
      const app = await recruitStore.getById(appId);
      if (app) {
        const s = await recruitStore.getSettings(app.guildId);
        const user = await inter.client.users.fetch(app.userId).catch(() => null);
        if (user) {
          const msg = s.dmAcceptedTemplate || 'Parabéns! Você foi aprovado.';
          await user.send(`✅ **Sua candidatura foi aprovada!**\n\n${msg}`).catch(() => null);
        }

        // Atualizar card se possível
        // ... (lógica de atualizar card existente seria ideal aqui)
      }

      await notice(inter, '✅ Candidato aprovado!', true);
    }
  } finally {
    processing.delete(k);
  }
}

export async function handleDecisionRejectSubmit(inter: ModalSubmitInteraction, appId: string) {
  await ack(inter, { flags: MessageFlags.Ephemeral });

  const reason =
    ((inter as any).fields.getTextInputValue('reason') || '').trim() || 'Sem motivo informado';

  const approverDisplay =
    (inter.member && 'displayName' in inter.member ? (inter.member as any).displayName : null) ??
    inter.user.username;

  await recruitStore.setStatus(appId, 'rejected', inter.user.id);

  // Tentar enviar DM
  const app = await recruitStore.getById(appId);
  if (app) {
    const s = await recruitStore.getSettings(app.guildId);
    const user = await inter.client.users.fetch(app.userId).catch(() => null);
    if (user) {
      const msg = s.dmRejectedTemplate || 'Infelizmente você não foi aprovado.';
      await user.send(`❌ **Sua candidatura foi reprovada.**\n\n**Motivo:** ${reason}\n\n${msg}`).catch(() => null);
    }
  }

  await notice(inter, '✅ Candidato reprovado.', true);
}
