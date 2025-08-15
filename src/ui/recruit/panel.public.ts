// src/ui/recruit/panel.public.ts
// Painel público V2 (NOVO) — NÃO substitui seu panel.ts atual.
// Container único com MediaGallery, Section (+Thumbnail quando houver),
// StringSelect de classe e botão "Iniciar Recrutamento" que abre o modal de perguntas.

import {
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type ButtonInteraction,
} from 'discord.js';

// paths para sua base atual (com extensão .js para compatibilidade de módulo)
import { recruitStore } from '../../modules/recruit/store.js';
import * as recruitDrafts from '../../modules/recruit/store.drafts.js';
import { buildApplicationCard } from '../../modules/recruit/card.js';

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
  applyQModalPrefix: 'recruit:pub:apply:q:modal:', // +appId
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

  // 1) banner opcional (imagem grande do topo)
  if (s.appearanceImageUrl) {
    containerChildren.push({
      type: V2.MediaGallery,
      items: [{ media: { url: s.appearanceImageUrl } }],
    });
  }

  // 2) título/descrição
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

  // separador
  containerChildren.push({ type: V2.Separator, divider: true, spacing: 1 });

  // 3) select de classes
  const classes = (s as any).classes ?? [];
  const options =
    classes.slice(0, 25).map((c: any) => ({
      label: `${c.emoji ? `${c.emoji} ` : ''}${c.name}`,
      value: String(c.id),
      description: c.roleId ? `Cargo vinculado` : undefined,
    })) ?? [];

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
          : [{ label: 'Nenhuma classe configurada', value: 'void', description: 'Peça a um admin para configurar' }],
        disabled: !options.length,
      },
    ],
  };
  // [CORREÇÃO] Adiciona a fileira de seleção ao container
  containerChildren.push(rowSelect);

  // 4) botões (definir nick + iniciar recrutamento)
  const rowButtons = {
    type: V2.ActionRow,
    components: [
      { type: V2.Button, style: ButtonStyle.Primary, custom_id: PUB_IDS.nickOpen, label: 'Definir Nick' },
      { type: V2.Button, style: ButtonStyle.Success, custom_id: PUB_IDS.start, label: 'Iniciar Recrutamento' },
    ],
  };
  // [CORREÇÃO] Adiciona a fileira de botões ao container
  containerChildren.push(rowButtons);

  return {
    flags: 1 << 15, // MessageFlags.IsComponentsV2
    components: [
      { type: V2.Container, accent_color: (s as any).appearanceAccent ?? 0x3D348B, components: containerChildren },
    ],
  } as const;
}

/** Publica/atualiza o painel sem tocar no seu panel.ts atual */
export async function publishPublicRecruitPanelV2(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
) {
  if (!interaction.inCachedGuild()) return;
  const guildId = interaction.guildId!;
  const payload = await renderPublicRecruitPanelV2(guildId);

  const settings = await recruitStore.getSettings(guildId);
  const target =
    settings.panelChannelId
      ? await interaction.client.channels.fetch(settings.panelChannelId).catch(() => null)
      : interaction.channel;

  if (!target || !target.isTextBased()) {
    await (interaction as any).reply?.({ ephemeral: true, content: '❌ Canal inválido para painel.' }).catch(() => null);
    return;
  }

  // tentar editar painel salvo
  const saved = await (recruitStore as any).getPanel?.(guildId).catch(() => null);
  if (saved?.channelId && saved?.messageId) {
    const ch = await interaction.client.channels.fetch(saved.channelId).catch(() => null);
    if (ch?.isTextBased()) {
      const msg = await (ch as GuildTextBasedChannel).messages.fetch(saved.messageId).catch(() => null);
      if (msg) {
        await msg.edit(payload);
        return;
      }
    }
  }

  // senão, enviar novo
  const sent = await (target as GuildTextBasedChannel).send(payload);
  await (recruitStore as any).setPanel?.(guildId, { channelId: (sent.channel as any).id, messageId: sent.id });
}

/* ---------------- Interações públicas ---------------- */

export async function handleClassSelect(inter: StringSelectMenuInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== PUB_IDS.classSelect) return false;
  const guildId = inter.guildId!;
  const classId = inter.values?.[0];
  if (!classId || classId === 'void') {
    await inter.reply({ ephemeral: true, content: '❌ Classe inválida.' });
    return true;
  }
  await recruitDrafts.setUserDraft(guildId, inter.user.id, { classId });
  await inter.reply({
    ephemeral: true,
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
    await inter.reply({ ephemeral: true, content: '❌ Nick inválido.' });
    return true;
  }
  await recruitDrafts.setUserDraft(inter.guildId!, inter.user.id, { nick });
  await inter.reply({
    ephemeral: true,
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
    await inter.reply({ ephemeral: true, content: '⚠️ Selecione sua classe antes de iniciar.' });
    return true;
  }

  const s = await recruitStore.getSettings(guildId);
  const qs = recruitStore.parseQuestions(s.questions);

  const classes = (s as any).classes ?? [];
  const cls = classes.find((c: any) => String(c.id) === String(draft.classId));
  const className = cls?.name ?? '—';

  const activityCount = await (recruitStore as any).getMessageCount?.(guildId, userId).catch(() => 0);

  const app = await recruitStore.create({
    guildId,
    userId,
    username: inter.user.username,
    nick: draft.nick!,
    className,
  });
  (app as any).classId = draft.classId;
  (app as any).activityCount = activityCount;

  await recruitDrafts.clearUserDraft(guildId, userId);

  if (qs.length) {
    const modal = new ModalBuilder()
      .setCustomId(PUB_IDS.applyQModalPrefix + app.id)
      .setTitle('Perguntas de Recrutamento');

    qs.slice(0, 4).forEach((q: string, idx: number) => {
      modal.addComponents(
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

    await inter.showModal(modal);
    return true;
  }

  await publishApplication(inter, app.id);
  return true;
}

export async function handleApplyQuestionsSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild() || !inter.customId.startsWith(PUB_IDS.applyQModalPrefix)) return false;
  const appId = inter.customId.slice(PUB_IDS.applyQModalPrefix.length);
  const answers: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const v = inter.fields.getTextInputValue(`q${i}`) || '';
    if (v.trim()) answers.push(v.trim());
  }
  await recruitStore.setAnswers(appId, answers);
  await publishApplication(inter, appId);
  return true;
}

/* ---------------- helpers ---------------- */

async function publishApplication(interaction: ModalSubmitInteraction | ButtonInteraction, appId: string) {
  const app = await recruitStore.getById(appId);
  if (!app) {
    await (interaction as any).reply?.({ ephemeral: true, content: '❌ Aplicação não encontrada.' }).catch(() => null);
    return;
  }
  const s = await recruitStore.getSettings(app.guildId);
  const fallbackChannelId = interaction.channel?.id ?? interaction.guild?.rulesChannelId ?? null;
  const targetId = s.formsChannelId ?? fallbackChannelId;

  if (!targetId) {
    await (interaction as any)
      .reply?.({
        ephemeral: true,
        content: '❌ Configure o **Canal de formulário** em Recrutamento (ou execute em um canal de texto).',
      })
      .catch(() => null);
    return;
  }

  const target = await interaction.client.channels.fetch(targetId).catch(() => null);
  if (!target || !target.isTextBased()) {
    await (interaction as any)
      .reply?.({ ephemeral: true, content: '❌ Canal alvo inválido para publicar o formulário.' })
      .catch(() => null);
    return;
  }

  const payload = await buildApplicationCard(interaction.client, app as any, {
    questions: recruitStore.parseQuestions(s.questions),
    dmAcceptedTemplate: s.dmAcceptedTemplate,
    dmRejectedTemplate: s.dmRejectedTemplate,
  });

  const sent = await (target as GuildTextBasedChannel).send(payload);
  await recruitStore.setCardRef(app.id, { channelId: (sent.channel as any).id, messageId: sent.id });

  if ('reply' in interaction) {
    await (interaction as any)
      .reply?.({ ephemeral: true, content: '✅ Candidatura enviada para a staff.' })
      .catch(() => null);
  }
}
