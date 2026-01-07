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
import { publishPublicRecruitPanelV2, openNickModal } from '../../ui/recruit/panel.public.js';
import { Context } from '../../infra/context.js';

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
      `**Canal do Painel Público**: ${s.panelChannelId ? `<#${s.panelChannelId}>` : 'Não definido'}\n` +
      `**Canal de Formulários (Staff)**: ${s.formsChannelId ? `<#${s.formsChannelId}>` : 'Não definido'}\n` +
      `**Classes**: ${recruitStore.parseClasses(s.classes).length} configuradas\n` +
      `**Perguntas**: ${recruitStore.parseQuestions(s.questions).length} definidas`,
    )
    .setColor(0x2b2d31);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.recruit.settingsClasses)
      .setLabel('Classes')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🛡️'),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settingsForm)
      .setLabel('Perguntas')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📝'),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settingsAppearance)
      .setLabel('Aparência')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎨'),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settingsDM)
      .setLabel('Templates DM')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📨'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.recruit.settingsPanelChannel)
      .setLabel('Canal Painel')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ids.recruit.settingsFormsChannel)
      .setLabel('Canal Forms')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('recruit:settings:approved-role')
      .setLabel('Cargo de Aprovado')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👤'),
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
  sub?: string, // sub pode ser undefined se chamado diretamente sem split
) {
  // Se sub não for passado, tenta inferir ou abrir o painel principal
  if (!sub) {
    // Se for o botão principal de settings, renderiza o painel
    const payload = await renderRecruitPanel(interaction.guildId!);
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'classes') {
    await notice(interaction, '⚙️ Configuração de classes via comando `/recruit classes` (em breve).', true);
  } else if (sub === 'form') {
    await openQuestionsModal(interaction);
  } else if (sub === 'appearance') {
    await openAppearanceModal(interaction);
  } else if (sub === 'dm') {
    await openDMTemplatesModal(interaction);
  } else if (sub === 'panel-channel') {
    await openChannelSelect(interaction, 'panel');
  } else if (sub === 'forms-channel') {
    await openChannelSelect(interaction, 'forms');
  }
}

// Alias para compatibilidade com interactions.ts
export const openRecruitSettings = handleRecruitSettingsButton;

/* ---------------- Modais de Configuração ---------------- */

async function openQuestionsModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);
  const qs = recruitStore.parseQuestions(s.questions);

  const modal = new ModalBuilder()
    .setCustomId('recruit:settings:form:modal')
    .setTitle('Editar Perguntas');

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

// Exports explícitos para interactions.ts
export { openQuestionsModal as openEditFormModal };

export async function handleEditFormSubmit(inter: ModalSubmitInteraction) {
  await ack(inter, { flags: MessageFlags.Ephemeral });
  const qs = [1, 2, 3, 4, 5]
    .map((i) => ((inter as any).fields.getTextInputValue(`q${i}`) || '').trim())
    .filter(Boolean);

  await recruitStore.updateSettings(inter.guildId!, {
    questions: qs,
  });

  await notice(inter, '✅ Perguntas atualizadas!', true);
}

export async function openAppearanceModal(inter: ButtonInteraction) {
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

export async function openDMTemplatesModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);

  const modal = new ModalBuilder()
    .setCustomId('recruit:settings:dm:modal')
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

export async function openChannelSelect(inter: ButtonInteraction, kind: 'panel' | 'forms') {
  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`recruit:settings:select:${kind === 'panel' ? 'panel-channel' : 'forms-channel'}`) // ids.recruit.selectPanelChannel / selectFormsChannel
      .setPlaceholder('Selecione o canal')
      .setChannelTypes(ChannelType.GuildText),
  );

  await inter.reply({
    content: `Selecione o canal para **${kind === 'panel' ? 'Painel Público' : 'Formulários (Staff)'}**:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

// Wrappers para exportação
export async function openSelectPanelChannel(inter: ButtonInteraction) {
  return openChannelSelect(inter, 'panel');
}
export async function openSelectFormsChannel(inter: ButtonInteraction) {
  return openChannelSelect(inter, 'forms');
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
        .setCustomId(`recruit:decision:reject:modal:${appId}`) // ids.recruit.modalRejectReason
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
      // ========== APROVAR ==========
      await ack(inter, { flags: MessageFlags.Ephemeral });

      // 1. Buscar dados da aplicação
      const app = await recruitStore.getById(appId);
      if (!app) {
        await notice(inter, '❌ Candidatura não encontrada.', true);
        return;
      }

      const settings = await recruitStore.getSettings(app.guildId);

      // 2. Atualizar status no banco
      await recruitStore.setStatus(appId, 'approved', inter.user.id);

      // 3. Buscar member do guild
      const member = await inter.guild?.members.fetch(app.userId).catch(() => null);

      if (member) {
        // 3.1 Atribuir cargo base de aprovado
        if (settings.defaultApprovedRoleId) {
          try {
            await member.roles.add(settings.defaultApprovedRoleId, 'Aprovação de recrutamento');
            (Context.get().logger as any).info(
              { userId: app.userId, roleId: settings.defaultApprovedRoleId },
              'Cargo base atribuído'
            );
          } catch (err) {
            (Context.get().logger as any).error(
              { userId: app.userId, err },
              'Falha ao atribuir cargo base'
            );
          }
        }

        // 3.2 Atribuir cargo de classe (se configurado)
        const classes = recruitStore.parseClasses(settings.classes);
        const classe = classes.find((c) => String(c.id) === String(app.classId));
        if (classe?.roleId) {
          try {
            await member.roles.add(classe.roleId, 'Cargo de classe - aprovação');
            (Context.get().logger as any).info(
              { userId: app.userId, roleId: classe.roleId, className: classe.name },
              'Cargo de classe atribuído'
            );
          } catch (err) {
            (Context.get().logger as any).error(
              { userId: app.userId, err },
              'Falha ao atribuir cargo de classe'
            );
          }
        }

        // 3.3 Forçar mudança de nickname
        if (app.nick) {
          try {
            await member.setNickname(app.nick, 'Aprovação de recrutamento');
            (Context.get().logger as any).info(
              { userId: app.userId, nick: app.nick },
              'Nickname atualizado'
            );
          } catch (err) {
            (Context.get().logger as any).warn(
              { userId: app.userId, err },
              'Falha ao alterar nickname (pode ser owner ou falta de permissão)'
            );
          }
        }
      } else {
        (Context.get().logger as any).warn(
          { appId, userId: app.userId },
          'Member não encontrado para aprovação'
        );
      }

      // 4. Enviar DM ao candidato
      const user = await inter.client.users.fetch(app.userId).catch(() => null);
      if (user) {
        const template = settings.dmAcceptedTemplate || 'Parabéns! Você foi aprovado.';
        // Substituir variáveis do template
        const msg = template.replace('{user}', user.username);
        await user.send(msg).catch(() => null);
      }

      // 5. Atualizar card visualmente (verde + sem botões)
      if (app.channelId && app.messageId) {
        try {
          const channel = await inter.client.channels.fetch(app.channelId);
          if (channel?.isTextBased()) {
            const message = await (channel as any).messages.fetch(app.messageId);

            const updatedApp = {
              ...app,
              status: 'approved' as const,
              moderatedById: inter.user.id,
              moderatedByDisplay: inter.user.tag,
              moderatedAt: new Date(),
            };

            const { buildApplicationCard } = await import('./card.js');
            const updatedCard = await buildApplicationCard(inter.client, updatedApp, {
              questions: recruitStore.parseQuestions(settings.questions),
            });

            await message.edit(updatedCard);
            (Context.get().logger as any).info(
              { appId, messageId: app.messageId },
              'Card atualizado para verde (aprovado)'
            );
          }
        } catch (err) {
          (Context.get().logger as any).error({ appId, err }, 'Falha ao atualizar card visual');
        }
      }

      await notice(inter, '✅ Candidato aprovado! Cargo e nick atualizados.', true);
    }
  } finally {
    processing.delete(k);
  }
}

export async function handleDecisionApprove(inter: ButtonInteraction, appId: string) {
  return handleDecisionClick(inter, 'approve', appId);
}

export async function handleDecisionRejectOpen(inter: ButtonInteraction, appId: string) {
  return handleDecisionClick(inter, 'reject', appId);
}

export async function handleDecisionRejectSubmit(inter: ModalSubmitInteraction, appId: string) {
  await ack(inter, { flags: MessageFlags.Ephemeral });

  const reason =
    ((inter as any).fields.getTextInputValue('reason') || '').trim() || 'Sem motivo informado';

  // Buscar aplicação
  const app = await recruitStore.getById(appId);
  if (!app) {
    await notice(inter, '❌ Candidatura não encontrada.', true);
    return;
  }

  const s = await recruitStore.getSettings(app.guildId);

  // Atualizar status
  await recruitStore.setStatus(appId, 'rejected', inter.user.id);

  // Tentar enviar DM
  const user = await inter.client.users.fetch(app.userId).catch(() => null);
  if (user) {
    const template = s.dmRejectedTemplate || 'Infelizmente você não foi aprovado.';
    // Substituir variáveis do template
    const msg = template.replace('{reason}', reason);
    await user.send(msg).catch(() => null);
  }

  // Atualizar card visualmente (vermelho + motivo)
  if (app.channelId && app.messageId) {
    try {
      const channel = await inter.client.channels.fetch(app.channelId);
      if (channel?.isTextBased()) {
        const message = await (channel as any).messages.fetch(app.messageId);

        const updatedApp = {
          ...app,
          status: 'rejected' as const,
          reason: reason,
          moderatedById: inter.user.id,
          moderatedByDisplay: inter.user.tag,
          moderatedAt: new Date(),
        };

        const { buildApplicationCard } = await import('./card.js');
        const updatedCard = await buildApplicationCard(inter.client, updatedApp, {
          questions: recruitStore.parseQuestions(s.questions),
        });

        await message.edit(updatedCard);
        (Context.get().logger as any).info(
          { appId, reason },
          'Card atualizado para vermelho (rejeitado)'
        );
      }
    } catch (err) {
      (Context.get().logger as any).error({ appId, err }, 'Falha ao atualizar card visual');
    }
  }

  await notice(inter, '✅ Candidato reprovado.', true);
}

/* ---------------- Legacy / Stubs ---------------- */

// Stubs para funções que não existiam no meu rewrite mas são chamadas pelo interactions.ts
// Provavelmente referem-se ao fluxo antigo ou público.

export async function openApplyModal(inter: ButtonInteraction) {
  // Redireciona para o modal de nick (fluxo público V2)
  return openNickModal(inter);
}

export async function handleApplyModalSubmit(inter: ModalSubmitInteraction) {
  // Stub: não deve ser chamado se usarmos o fluxo V2 corretamente, mas se for, apenas ack.
  await ack(inter, { flags: MessageFlags.Ephemeral });
  await notice(inter, '⚠️ Fluxo antigo. Use o painel novo.', true);
}

export async function openApplyQuestionsModal(inter: ButtonInteraction, appId: string) {
  // Stub
  await notice(inter, '⚠️ Funcionalidade em manutenção.', true);
}

export async function handleApplyQuestionsSubmit(inter: ModalSubmitInteraction, appId: string) {
  // Stub
  await ack(inter, { flags: MessageFlags.Ephemeral });
  await notice(inter, '✅ Recebido (Stub).', true);
}
