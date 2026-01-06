// src/ui/recruit/panel.public.ts — fix TS2345 (narrowing de string) + modal dinâmico + flags
// - Corrige erros TS2345 em chamadas que esperavam `string` e recebiam `string | undefined`
// - Faz narrowing explícito (guards) para `appId`, `targetId` e `app.id`
// - Mantém correções anteriores: modal dinâmico com total no customId e uso de flags

import {
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  FileUploadBuilder,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type ButtonInteraction,
  type Attachment,
} from 'discord.js';

import { recruitStore } from '../../modules/recruit/store.js';
import * as recruitDrafts from '../../modules/recruit/store.drafts.js';
import { buildApplicationCard } from '../../modules/recruit/card.js';
import { logger } from '../../infra/logger.js';

const V2 = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  Separator: 14,
  Container: 17,
} as const;

export const PUB_IDS = {
  classSelect: 'recruit:pub:class:select',
  nickOpen: 'recruit:pub:nick:open',
  nickModal: 'recruit:pub:nick:modal',
  start: 'recruit:pub:start',
  applyQModalPrefix: 'recruit:pub:apply:q:modal:', // +appId[:total]
} as const;

function esc(s?: string | null) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|');
}

/** Render do painel público em Components V2 */
export async function renderPublicRecruitPanelV2(guildId: string) {
  const s = await recruitStore.getSettings(guildId);

  const containerChildren: any[] = [];

  if (s.appearanceImageUrl) {
    containerChildren.push({
      type: V2.MediaGallery,
      items: [{ media: { url: s.appearanceImageUrl } }],
    });
  }

  const headerTexts: any[] = [
    { type: V2.TextDisplay, content: `# ${esc(s.appearanceTitle ?? 'Recrutamento')}` },
  ];
  if (s.appearanceDescription) {
    headerTexts.push({ type: V2.TextDisplay, content: s.appearanceDescription });
  }

  const thumbUrl = (s as any).appearanceThumbUrl as string | undefined;
  if (thumbUrl && thumbUrl.trim().length) {
    containerChildren.push({
      type: V2.Section,
      components: headerTexts,
      accessory: { type: V2.Thumbnail, media: { url: thumbUrl } },
    });
  } else {
    containerChildren.push(...headerTexts);
  }

  containerChildren.push({ type: V2.Separator, divider: true, spacing: 1 });

  const classes = recruitStore.parseClasses(s.classes);
  const options = classes.slice(0, 25).map((c: any) => ({
    label: `${c.emoji ? `${c.emoji} ` : ''}${c.name}`,
    value: String(c.id),
    description: c.roleId ? `Cargo vinculado` : undefined,
  }));

  const rowSelect = {
    type: V2.ActionRow,
    components: [
      {
        type: V2.StringSelect,
        custom_id: PUB_IDS.classSelect,
        placeholder: 'Selecione sua classe',
        min_values: 1,
        max_values: 1,
        options: options.length
          ? options
          : [
            {
              label: 'Nenhuma classe configurada',
              value: 'void',
              description: 'Peça a um admin para configurar',
            },
          ],
        disabled: !options.length,
      },
    ],
  };
  containerChildren.push(rowSelect);

  const rowButtons = {
    type: V2.ActionRow,
    components: [
      {
        type: V2.Button,
        style: ButtonStyle.Primary,
        custom_id: PUB_IDS.nickOpen,
        label: 'Definir Nick',
      },
      {
        type: V2.Button,
        style: ButtonStyle.Success,
        custom_id: PUB_IDS.start,
        label: 'Iniciar Recrutamento',
      },
    ],
  };
  containerChildren.push(rowButtons);

  return {
    flags: 1 << 15, // MessageFlags.IsComponentsV2
    components: [
      {
        type: V2.Container,
        accent_color: (s as any).appearanceAccent ?? 0x3d348b,
        components: containerChildren,
      },
    ],
  } as const;
}

export async function publishPublicRecruitPanelV2(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
) {
  if (!interaction.inCachedGuild()) return;
  const guildId = interaction.guildId!;
  const payload = await renderPublicRecruitPanelV2(guildId);

  logger.info({
    guildId,
    hasComponents: !!payload.components,
    componentsCount: payload.components?.length,
    flags: payload.flags
  }, 'Panel payload generated');

  const settings = await recruitStore.getSettings(guildId);
  const fallbackChannelId: string | undefined =
    interaction.channel?.id ?? interaction.guild?.rulesChannelId ?? undefined;
  const targetId: string | undefined = settings.panelChannelId ?? fallbackChannelId; // <-- string | undefined

  if (!targetId) {
    const msg = '❌ Canal inválido para painel.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => null);
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
    return;
  }

  const target = await interaction.client.channels.fetch(targetId).catch(() => null);
  if (!target || !target.isTextBased()) {
    const msg = '❌ Canal inválido para painel.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => null);
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
    return;
  }

  const saved = await (recruitStore as any).getPanel?.(guildId).catch(() => null);
  logger.info({ guildId, saved: !!saved }, 'Checking for existing panel');

  if (saved?.channelId && saved?.messageId) {
    const ch = await interaction.client.channels.fetch(saved.channelId).catch(() => null);
    if (ch?.isTextBased()) {
      const msg = await (ch as GuildTextBasedChannel).messages
        .fetch(saved.messageId)
        .catch(() => null);
      if (msg) {
        logger.info({ guildId, channelId: saved.channelId, messageId: saved.messageId }, 'Editing existing panel');
        try {
          await msg.edit(payload);
          return;
        } catch (err) {
          logger.error({ guildId, err }, 'Failed to edit existing panel - will create new one');
          // Continua para criar novo painel
        }
      }
    }
  }

  logger.info({ guildId, targetId }, 'Sending new panel');
  const sent = await (target as GuildTextBasedChannel).send(payload);
  logger.info({ guildId, channelId: sent.channelId, messageId: sent.id }, 'Panel sent successfully');

  await (recruitStore as any).setPanel?.(guildId, {
    channelId: (sent.channel as any).id,
    messageId: sent.id,
  });
}

/* ---------------- Interações públicas ---------------- */

export async function handleClassSelect(inter: StringSelectMenuInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== PUB_IDS.classSelect) return false;
  const guildId = inter.guildId!;
  const classId = inter.values?.[0];
  if (!classId || classId === 'void') {
    await inter.reply({ flags: MessageFlags.Ephemeral, content: '❌ Classe inválida.' });
    return true;
  }
  await recruitDrafts.setUserDraft(guildId, inter.user.id, { classId });
  await inter.reply({
    flags: MessageFlags.Ephemeral,
    content: '✅ Classe salva. Agora defina seu Nick e clique em **Iniciar Recrutamento**.',
  });
  return true;
}

export async function openNickModal(inter: ButtonInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== PUB_IDS.nickOpen) return false;
  const modal = new ModalBuilder().setCustomId(PUB_IDS.nickModal).setTitle('Seu Nick');
  const input = new TextInputBuilder()
    .setCustomId('nick')
    .setLabel('Informe seu Nick')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await inter.showModal(modal);
  return true;
}

export async function handleNickModalSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== PUB_IDS.nickModal) return false;
  const nick = (inter.fields.getTextInputValue('nick') || '').trim();
  if (!nick) {
    await inter.reply({ flags: MessageFlags.Ephemeral, content: '❌ Nick inválido.' });
    return true;
  }
  await recruitDrafts.setUserDraft(inter.guildId!, inter.user.id, { nick });
  await inter.reply({
    flags: MessageFlags.Ephemeral,
    content: '✅ Nick salvo. Agora selecione sua classe e clique em **Iniciar Recrutamento**.',
  });
  return true;
}

export async function handleStartClick(inter: ButtonInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== PUB_IDS.start) return false;
  const guildId = inter.guildId!;
  const userId = inter.user.id;

  const draft = await recruitDrafts.getUserDraft(guildId, userId);
  if (!draft.nick) {
    await openNickModal(inter);
    return true;
  }
  if (!draft.classId) {
    await inter.reply({
      flags: MessageFlags.Ephemeral,
      content: '⚠️ Selecione sua classe antes de iniciar.',
    });
    return true;
  }

  const s = await recruitStore.getSettings(guildId);
  const qs = recruitStore.parseQuestions(s.questions);

  const classes = recruitStore.parseClasses(s.classes);
  const cls = classes.find((c) => String(c.id) === String(draft.classId));
  const className = cls?.name ?? '—';

  const activityCount = await (recruitStore as any)
    .getMessageCount?.(guildId, userId)
    .catch(() => 0);

  const app = await recruitStore.create({
    guildId,
    userId,
    username: inter.user.username,
    nick: draft.nick!,
    className,
    classId: draft.classId,
  });
  // (app as any).classId = draft.classId; // já passado no create
  (app as any).activityCount = activityCount;

  await recruitDrafts.clearUserDraft(guildId, userId);

  // MAX_FIELDS = 4 para dar espaço ao FileUpload (total 5)
  const MAX_FIELDS = 4;
  const total = Math.min(qs.length, MAX_FIELDS);

  const modal = new ModalBuilder()
    .setCustomId(`${PUB_IDS.applyQModalPrefix}${app.id}:${total}`)
    .setTitle('Perguntas de Recrutamento');

  qs.slice(0, total).forEach((q: string, idx: number) => {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${idx + 1}`)
          .setLabel(q.slice(0, 45) || `Pergunta ${idx + 1}`)
          .setRequired(false)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(300),
      ),
    );
  });

  // NOVO: File Upload (Anexo) - REMOVIDO (API Error 50035)
  // const fileUpload = new FileUploadBuilder()
  //   .setCustomId('attachment')
  //   .setRequired(false);
  //
  // modal.addComponents(
  //   new ActionRowBuilder<any>().addComponents(fileUpload)
  // );

  await inter.showModal(modal);
  return true;
}

export async function handleApplyQuestionsSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild() || !inter.customId.startsWith(PUB_IDS.applyQModalPrefix)) return false;

  const tail = inter.customId.slice(PUB_IDS.applyQModalPrefix.length);
  const [rawAppId, countRaw] = tail.split(':');
  const appId: string = (rawAppId ?? '').trim(); // <-- garante string
  let total = Number.parseInt(countRaw || '0', 10);

  if (!appId) {
    await inter.reply({ flags: MessageFlags.Ephemeral, content: '❌ ID de aplicação ausente.' });
    return true;
  }

  if (!Number.isFinite(total) || total <= 0) total = 5;

  const safeGet = (id: string): string => {
    try {
      return (inter.fields.getTextInputValue(id) || '').trim();
    } catch {
      return '';
    }
  };

  const answers: string[] = [];
  for (let i = 1; i <= total; i++) {
    const v = safeGet(`q${i}`);
    if (v) answers.push(v);
  }

  // Recuperar arquivo - REMOVIDO
  // @ts-ignore
  // const files = inter.fields.getUploadedFiles ? inter.fields.getUploadedFiles('attachment') : null;
  // const attachment = files && files.size > 0 ? files.first() : null;
  const attachment = null;

  await recruitStore.setAnswers(appId, answers);
  await publishApplication(inter, appId, attachment);
  return true;
}

/* ---------------- helpers ---------------- */

async function publishApplication(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  appId: string,
  attachment?: Attachment | null
) {
  const app = await recruitStore.getById(appId);
  if (!app || !app.id) {
    const msg = '❌ Aplicação não encontrada.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => null);
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
    return;
  }

  const s = await recruitStore.getSettings(app.guildId);
  const fallbackChannelId: string | undefined =
    interaction.channel?.id ?? interaction.guild?.rulesChannelId ?? undefined;
  const targetId: string | undefined = s.formsChannelId ?? fallbackChannelId;

  if (!targetId) {
    const msg = '❌ Configure o **Canal de formulário** em Recrutamento (ou execute em um canal de texto).';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => null);
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
    return;
  }

  const target = await interaction.client.channels.fetch(targetId).catch(() => null);
  if (!target || !target.isTextBased()) {
    const msg = '❌ Canal alvo inválido para publicar o formulário.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => null);
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
    return;
  }

  const payload = await buildApplicationCard(interaction.client, app as any, {
    questions: recruitStore.parseQuestions(s.questions),
    dmAcceptedTemplate: s.dmAcceptedTemplate,
    dmRejectedTemplate: s.dmRejectedTemplate,
  });

  // Anexar arquivo se houver
  const files = attachment ? [attachment] : [];

  const sent = await (target as GuildTextBasedChannel).send({
    ...payload,
    files
  });

  await recruitStore.setCardRef(app.id as string, {
    channelId: (sent.channel as any).id,
    messageId: sent.id,
  });

  // Salvar URL do anexo no banco
  if (attachment && sent.attachments.size > 0) {
    const sentAttachment = sent.attachments.first();
    if (sentAttachment) {
      await recruitStore.setAttachment(app.id, sentAttachment.url);
    }
  }

  // Send success message
  const msg = '✅ Candidatura enviada para a staff.';
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // ignore if interaction is already invalid
  }
}
