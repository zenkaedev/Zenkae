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
  type InteractionReplyOptions,
  Guild,
  Role,
  MessageFlags,
} from 'discord.js';

import { recruitStore } from './store';
import { buildScreen, replyV2Notice } from '../../ui/v2';
import { ids } from '../../ui/ids';
import { buildApplicationCard } from './card';
import { publishPublicRecruitPanelV2 } from '../../ui/recruit/panel.public';

/* -------------------------------------------------------
 * Helpers: ACK seguro + aviso compatível com defer
 * ----------------------------------------------------- */
const processing = new Set<string>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function keyFrom(inter: ButtonInteraction | ModalSubmitInteraction) {
  const cid = (inter as any).customId ?? (inter as any).custom_id ?? 'no-cid';
  const mid = inter.message && 'id' in inter.message ? inter.message.id : 'no-mid';
  return `${inter.id}:${cid}:${inter.user.id}:${mid}`;
}

/** Garante o reconhecimento rápido da interação para evitar timeout do token. */
async function ack(
  inter: ButtonInteraction | ModalSubmitInteraction | ChatInputCommandInteraction,
  opts?: { update?: boolean; ephemeral?: boolean },
) {
  try {
    if ((inter as any).isButton?.() || (inter as any).isAnySelectMenu?.()) {
      if (!inter.deferred && !inter.replied) {
        if (opts?.update) return await (inter as ButtonInteraction).deferUpdate();
        return await (inter as any).deferReply({
          flags: (opts?.ephemeral ?? true) ? MessageFlags.Ephemeral : undefined,
        });
      }
    } else if ('isModalSubmit' in inter && (inter as ModalSubmitInteraction).isModalSubmit()) {
      if (!inter.deferred && !inter.replied) {
        return await (inter as any).deferReply({
          flags: (opts?.ephemeral ?? true) ? MessageFlags.Ephemeral : undefined,
        });
      }
    } else {
      // slash, etc
      if (!inter.deferred && !inter.replied) {
        return await (inter as any).deferReply({
          flags: (opts?.ephemeral ?? true) ? MessageFlags.Ephemeral : undefined,
        });
      }
    }
  } catch {
    // ignore
  }
}

/** Envia feedback respeitando se já houve defer. */
async function notice(
  inter: ButtonInteraction | ModalSubmitInteraction | ChatInputCommandInteraction,
  message: string,
  ephemeral = true,
  options?: Omit<InteractionReplyOptions, 'content' | 'ephemeral'>,
) {
  try {
    if (inter.deferred) {
      const { flags, ...safe } = options ?? {};
      return await (inter as any).editReply({ content: message, ...safe });
    }
    return await replyV2Notice(inter as any, message, ephemeral);
  } catch {
    if ((inter as any).replied) {
      try {
        return await (inter as any)
          .followUp?.({
            content: message,
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
          })
          .catch(() => null);
      } catch {}
    }
  }
}

/* -------------------------------------------------------
 * Helpers: Guild ops (roles & nick) + estilo de classe
 * ----------------------------------------------------- */

// Busca/Cria cargo por nome
async function ensureRoleByName(guild: Guild, name: string): Promise<Role> {
  const cached = guild.roles.cache.find((r) => r.name === name);
  if (cached) return cached;

  const fetched = await guild.roles.fetch().catch(() => null);
  const exists = fetched?.find((r) => r.name === name);
  if (exists) return exists!;

  return await guild.roles.create({
    name,
    mentionable: true,
    reason: `[recruit] auto-create role ${name}`,
  });
}

// Atribui cargos de forma idempotente
async function addRolesSafe(guild: Guild, userId: string, roleIds: string[]) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  const toAdd = roleIds.filter((id) => !member.roles.cache.has(id));
  if (toAdd.length) await member.roles.add(toAdd).catch(() => {});
}

// Atualiza apelido com fallback silencioso
async function setNicknameSafe(guild: Guild, userId: string, nick: string) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  await member.setNickname(nick).catch(() => {});
}

// ---- Estilo de Classe (cor + emoji + hoist) ----
/** Aceita #RGB / #RRGGBB / RGB / RRGGBB → retorna número 0xRRGGBB */
function parseHexColor(input?: string | null): number | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  const raw = s.startsWith('#') ? s.slice(1) : s;
  const short = /^([0-9a-f]{3})$/i.exec(raw);
  if (short?.[1]) {
    const [r, g, b] = short[1].split('');
    return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }
  const full = /^([0-9a-f]{6})$/i.exec(raw);
  if (full?.[1]) return parseInt(full[1], 16);
  return undefined;
}

function extractUnicodeEmoji(input?: string | null): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  // ignora custom <:name:id> ou <a:name:id>
  if (/^<a?:\w+:\d+>$/.test(s)) return undefined;
  const uni = s.match(/\p{Extended_Pictographic}/u)?.[0];
  return uni ?? undefined;
}

async function ensureClassRoleWithStyle(
  guild: Guild,
  className: string,
  classEmoji?: string | null,
  classColorHex?: string | null,
  existingRoleId?: string | null,
): Promise<Role> {
  const uni = extractUnicodeEmoji(classEmoji);
  const baseName = `Classe | ${className}`;
  const targetName = uni ? `Classe | ${uni} ${className}` : baseName;
  const color = parseHexColor(classColorHex);

  // 0) tenta por ID primeiro
  if (existingRoleId) {
    const byId = await guild.roles.fetch(String(existingRoleId)).catch(() => null);
    if (byId) {
      // nome/hoist/mentionable
      try {
        await byId.edit({ name: targetName, hoist: true, mentionable: true });
      } catch {}

      // cor — API nova
      if (typeof color !== 'undefined') {
        try { await (byId as any).setColors({ primaryColor: color }); } catch {}
      }

      // emoji unicode
      if (uni) {
        try { await (byId as any).setUnicodeEmoji(uni); } catch {}
      }
      return byId;
    }
  }

  // 1) tenta por nome
  const fetched = await guild.roles.fetch().catch(() => null);
  let role =
    fetched?.find((r) => r.name === targetName) ??
    fetched?.find((r) => r.name === baseName) ??
    guild.roles.cache.find((r) => r.name === targetName) ??
    guild.roles.cache.find((r) => r.name === baseName) ??
    null;

  // 2) cria se não existir
  if (!role) {
    role = await guild.roles
      .create({ name: targetName, hoist: true, mentionable: true, reason: `[recruit] auto-create class role ${className}` })
      .catch(() => null as any);
    await sleep(300); // evita race entre criar e editar
    if (!role) throw new Error('Falha ao criar cargo de classe');
  }

  // 3) restrições
  const managed = (role as any).managed;
  const editable = (role as any).editable;
  if (managed || !editable) return role;

  // 4) nome/hoist/mentionable
  if (role.name !== targetName || !role.hoist || !role.mentionable) {
    try { await role.edit({ name: targetName, hoist: true, mentionable: true }); } catch {}
  }

  // 5) cor — API nova
  if (typeof color !== 'undefined') {
    try { await (role as any).setColors({ primaryColor: color }); } catch {}
  }

  // 6) emoji unicode (se permitido no servidor)
  if (uni) {
    try { await (role as any).setUnicodeEmoji(uni); } catch {}
  }

  return role;
}

function toArraySafe(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set || value instanceof Map) return Array.from(value as any);
  if (typeof value === 'object') return Object.values(value);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object'
        ? Object.values(parsed)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Lê metadados da classe a partir de settings.classes (array, objeto, Map/Set ou JSON). */
function getClassMeta(
  settings: any,
  className: string,
): { id?: string | null; name: string; emoji?: string | null; color?: string | null } | null {
  const raw = toArraySafe(settings?.classes);

  // normaliza itens (caso venham como [key, value] de Map)
  const list = raw
    .map((c: any) => {
      if (Array.isArray(c) && c.length === 2 && typeof c[1] === 'object') return c[1];
      return c;
    })
    .filter(Boolean) as any[];

  const found = list.find((c: any) => {
    const n = (c?.name ?? c?.className ?? c?.title ?? '').toString();
    return n && n.toLowerCase() === className.toLowerCase();
  });

  if (!found) return null;

  const emojiVal = found.emoji ?? found.icon ?? null;
  const colorVal = found.color ?? found.colour ?? null;

  return {
    id: found.roleId ?? found.roleID ?? null,
    name: className,
    emoji: emojiVal != null ? String(emojiVal) : null,
    color: colorVal != null ? String(colorVal) : null, // #RRGGBB
  };
}

/* -------------------------------------------------------
 * Painel público (Components V2) — lê Aparência
 * ----------------------------------------------------- */
export function renderPublicRecruitPanel(opts?: { title?: string; description?: string }) {
  return buildScreen({
    title: opts?.title?.trim() || 'Painel de Recrutamento',
    subtitle:
      opts?.description?.trim() || 'Clique em **Quero entrar** para enviar seu nick e classe.',
    buttons: [{ id: ids.recruit.apply, label: 'Quero entrar' }],
  });
}

/* -------------------------------------------------------
 * Publicar/Atualizar painel público (edita se já existir)
 * ----------------------------------------------------- */
export async function handlePublishRecruitPanel(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
) {
  await ack(interaction, { ephemeral: true });
  return publishPublicRecruitPanelV2(interaction);
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

  await ack(interaction, { ephemeral: true });

  const guildId = interaction.guildId!;
  const user = interaction.user;

  const nick = interaction.fields.getTextInputValue('nick').trim();
  const className = interaction.fields.getTextInputValue('class').trim();

  try {
    const existing = await recruitStore.findByUser(guildId, user.id);
    if (existing && existing.status === 'pending') {
      await notice(interaction, '⚠️ Você já tem uma aplicação pendente.', true);
      return;
    }

    const app = await recruitStore.create({
      guildId,
      userId: user.id,
      username: user.username,
      nick,
      className,
    });

    // Perguntas personalizadas
    const settings = await recruitStore.getSettings(guildId);
    const questions = recruitStore.parseQuestions(settings.questions).slice(0, 4);

    if (questions.length) {
      await notice(interaction, 'Clique para responder às perguntas personalizadas.', true);
      await (interaction as any).followUp({
        flags: MessageFlags.Ephemeral,
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

    // Sem perguntas → publica o cartão direto
    await publishApplicationCard(interaction, app.id);
  } catch (e) {
    console.error('[recruit] handleApplyModalSubmit error:', e);
    await notice(interaction, '❌ Falha ao registrar candidatura.', true);
  }
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
  await ack(interaction, { ephemeral: true });
  try {
    const answers: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const v = interaction.fields.getTextInputValue(`q${i}`) || '';
      if (v.trim()) answers.push(v.trim());
    }
    await recruitStore.setAnswers(appId, answers);
    await publishApplicationCard(interaction, appId);
  } catch (e) {
    console.error('[recruit] handleApplyQuestionsSubmit error:', e);
    await notice(interaction, '❌ Falha ao salvar respostas.', true);
  }
}

/* -------------------------------------------------------
 * Publicação do cartão (robust targetId)
 * ----------------------------------------------------- */
async function publishApplicationCard(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  appId: string,
) {
  const app = await recruitStore.getById(appId);
  if (!app) {
    await notice(interaction, '❌ Aplicação não encontrada.', true);
    return;
  }

  const settings = await recruitStore.getSettings(app.guildId);

  // Resolve canal de publicação com fallback seguro
  const fallbackChannelId =
    (interaction as any).channel?.id ?? (interaction as any).guild?.rulesChannelId ?? null;
  const targetId = settings.formsChannelId ?? fallbackChannelId;

  if (!targetId) {
    console.warn('[recruit] No target channel. formsChannelId and fallback are null.', {
      guildId: app.guildId,
      formsChannelId: settings.formsChannelId,
      channelFromInteraction: (interaction as any).channel?.id,
    });
    await notice(
      interaction,
      '❌ Configure o **Canal de formulário** em Recrutamento (ou execute em um canal de texto).',
      true,
    );
    return;
  }

  const target = await (interaction as any).client.channels.fetch(targetId).catch(() => null);
  if (!target || !target.isTextBased()) {
    console.warn('[recruit] Target channel not text-based or not found:', { targetId });
    await notice(interaction, '❌ Canal alvo inválido para publicar o formulário.', true);
    return;
  }

  const cardPayload = await buildApplicationCard((interaction as any).client, app as any, {
    questions: recruitStore.parseQuestions(settings.questions),
    dmAcceptedTemplate: settings.dmAcceptedTemplate,
    dmRejectedTemplate: settings.dmRejectedTemplate,
  });

  const sent = await (target as GuildTextBasedChannel).send(cardPayload);

  try {
    await recruitStore.setCardRef(app.id, {
      channelId: (sent.channel as any).id,
      messageId: sent.id,
    });
  } catch {}

  await notice(interaction, '✅ Sua candidatura foi registrada! Aguarde retorno da staff.', true);
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
      { id: ids.recruit.settingsClasses, label: 'Gerir Classes' },
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

  const modal = new ModalBuilder().setCustomId(ids.recruit.modalForm).setTitle('Editar formulário (4 perguntas)');

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
  await ack(inter, { ephemeral: true });
  const qs = [1, 2, 3, 4]
    .map((i) => ((inter as any).fields.getTextInputValue(`q${i}`) || '').trim())
    .filter(Boolean);
  await recruitStore.updateSettings(inter.guildId!, { questions: qs });
  await notice(inter, '✅ Formulário atualizado.', true);
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
  await ack(inter, { ephemeral: true });
  await recruitStore.updateSettings(inter.guildId!, {
    appearanceTitle: ((inter as any).fields.getTextInputValue('title') || '').trim() || null,
    appearanceDescription: ((inter as any).fields.getTextInputValue('desc') || '').trim() || null,
    appearanceImageUrl: ((inter as any).fields.getTextInputValue('image') || '').trim() || null,
  });
  await notice(inter, '✅ Aparência atualizada.', true);
}

export async function openDMTemplatesModal(inter: ButtonInteraction) {
  const s = await recruitStore.getSettings(inter.guildId!);
  const modal = new ModalBuilder().setCustomId(ids.recruit.modalDM).setTitle('Templates de DM');

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
  await ack(inter, { ephemeral: true });
  await recruitStore.updateSettings(inter.guildId!, {
    dmAcceptedTemplate:
      ((inter as any).fields.getTextInputValue('ok') || '').trim() || 'Parabéns! Você foi aprovado 🎉',
    dmRejectedTemplate:
      ((inter as any).fields.getTextInputValue('no') || '').trim() ||
      'Obrigado por se inscrever. Infelizmente sua candidatura foi recusada. Motivo: {reason}',
  });
  await notice(inter, '✅ Templates de DM atualizados.', true);
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
  await ack(inter as ButtonInteraction, { ephemeral: true });
  const selId = (inter.values?.[0] as string | undefined) ?? undefined;
  if (!selId) {
    await notice(inter, '❌ Selecione um canal.', true);
    return;
  }

  const data: any = {};
  if (kind === 'panel') data.panelChannelId = selId;
  if (kind === 'forms') data.formsChannelId = selId;

  await recruitStore.updateSettings(inter.guildId!, data);
  await notice(inter, '✅ Canal salvo.', true);
}

/* -------------------------------------------------------
 * Decisão (aprovar / recusar) + refresh de card
 * ----------------------------------------------------- */
export async function handleDecisionApprove(inter: ButtonInteraction, appId: string) {
  const k = keyFrom(inter);
  if (processing.has(k)) {
    await ack(inter, { update: true });
    return;
  }
  processing.add(k);

  try {
    await ack(inter, { ephemeral: true });

    const approverDisplay =
      (inter.member && 'displayName' in inter.member ? (inter.member as any).displayName : null) ??
      inter.user.globalName ??
      inter.user.username;

    const app = await recruitStore.updateStatus(appId, 'approved', null, inter.user.id, approverDisplay);

    // ====== DISCORD: nick + cargos (cor/emoji/hoist para classe) ======
    const guild =
      inter.guild ?? (await inter.client.guilds.fetch(app.guildId).then((g) => g.fetch()).catch(() => null));

    if (guild) {
      // 1) Nick do formulário
      if ((app as any).nick) {
        await setNicknameSafe(guild, app.userId, (app as any).nick);
      }

      const settings = await recruitStore.getSettings(app.guildId);

      // 2) Cargo geral (Aprovado) via defaultApprovedRoleId
      let generalRoleId: string | null | undefined = (settings as any).defaultApprovedRoleId;
      if (!generalRoleId) {
        const role = await ensureRoleByName(guild, 'Aprovado');
        generalRoleId = role.id;
        try {
          await recruitStore.updateSettings(app.guildId, { defaultApprovedRoleId: role.id });
        } catch {}
      }

      // 3) Cargo de classe com estilo (cor/emoji/hoist)
      let classRoleId: string | null = null;
      const className = ((app as any).className || '').trim();
      if (className) {
        const meta = getClassMeta(settings, className);

        // compat: usa mapeamento do store se existir; senão, usa meta?.id
        const getClassRoleId = (recruitStore as any).getClassRoleId?.bind(recruitStore);
        const setClassRoleId = (recruitStore as any).setClassRoleId?.bind(recruitStore);
        const savedId = getClassRoleId ? await getClassRoleId(app.guildId, className) : meta?.id ?? undefined;

        const role = await ensureClassRoleWithStyle(
          guild,
          className,
          meta?.emoji ?? undefined,
          meta?.color ?? undefined,
          savedId ?? undefined,
        );
        classRoleId = role.id;

        try {
          if (setClassRoleId) await setClassRoleId(app.guildId, className, role.id);
        } catch {}
      }

      // 4) Atribui cargos
      const rolesToAdd = [generalRoleId, classRoleId].filter(Boolean) as string[];
      if (rolesToAdd.length) {
        await addRolesSafe(guild, app.userId, rolesToAdd);
      }
    }

    await refreshCard(inter, appId);

    const s = await recruitStore.getSettings(app.guildId);
    const templ = s.dmAcceptedTemplate ?? 'Parabéns! Você foi aprovado 🎉';
    try {
      const u = await inter.client.users.fetch(app.userId);
      await u.send(templ);
    } catch {}

    await notice(inter, '✅ Aplicação aprovada. Nick atualizado e cargos atribuídos.', true);
  } finally {
    processing.delete(k);
  }
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
  await ack(inter, { ephemeral: true });

  const reason = ((inter as any).fields.getTextInputValue('reason') || '').trim() || 'Sem motivo informado';

  const moderatorDisplay =
    ((inter as any).member && 'displayName' in (inter as any).member
      ? ((inter as any).member as any).displayName
      : null) ??
    (inter as any).user.globalName ??
    (inter as any).user.username;

  const app = await recruitStore.updateStatus(appId, 'rejected', reason, (inter as any).user.id, moderatorDisplay);

  await refreshCard(inter as any, appId);

  const s = await recruitStore.getSettings((app as any).guildId);
  const templ = (s.dmRejectedTemplate ?? 'Sua candidatura foi recusada. Motivo: {reason}').replaceAll('{reason}', reason);

  try {
    const u = await (inter as any).client.users.fetch((app as any).userId);
    await u.send(templ);
  } catch {}
  await notice(inter as any, '✅ Aplicação recusada.', true);
}

async function refreshCard(inter: ButtonInteraction | ModalSubmitInteraction, appId: string) {
  const app = await recruitStore.getById(appId);
  if (!app?.channelId || !app?.messageId) return;

  const ch = await (inter as any).client.channels.fetch(app.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;

  const msg = await (ch as GuildTextBasedChannel).messages.fetch(app.messageId).catch(() => null);
  if (!msg) return;

  const s = await recruitStore.getSettings(app.guildId);
  const card = await buildApplicationCard((inter as any).client, app as any, {
    questions: recruitStore.parseQuestions(s.questions),
    dmAcceptedTemplate: s.dmAcceptedTemplate,
    dmRejectedTemplate: s.dmRejectedTemplate,
  });

  await msg.edit(card);
}
