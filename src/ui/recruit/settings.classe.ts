// src/ui/recruit/settings.classe.ts — FULL
// ✅ V2 puro (sem misturar builders do Container V2 com JSON)
// ✅ Mesmos recursos: ID auto, cor da classe (#RRGGBB), aplicar cor no cargo, listagem, editar/remover
// ✅ Handlers: openRecruitClassesSettings, handleClassesSelect, openClassModal, handleClassModalSubmit, handleClassRemove
// ✅ Defensivo contra TS2532/TS2339
// ✅ Atualiza painel público após alterações
// ✅ Atualizado: usa role.setColors({ primaryColor }) em vez de setColor/edit({ color })
// ✅ Normalização aceita #RGB → #RRGGBB, e converte para inteiro ao aplicar

import {
  ButtonInteraction,
  ButtonStyle,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ActionRowBuilder,
} from 'discord.js';
import { randomUUID } from 'node:crypto';

import { recruitStore, type Class } from '../../modules/recruit/store.js';
import { replyV2Notice } from '../v2.js';
import { publishPublicRecruitPanelV2 } from './panel.public.js';
import { ids } from '../ids.js';

// Tipos do Components V2 utilizados
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

/* ----------------------- helpers ----------------------- */

/** Converte string em objeto de emoji aceito pelo Discord. */
function toEmoji(
  input?: string | null,
): { id?: string; name?: string; animated?: boolean } | undefined {
  const s = (typeof input === 'string' ? input : '').trim();
  if (!s) return undefined;

  const m = /^<a?:(\w+):(\d+)>$/.exec(s);
  if (m && m[1] && m[2]) return { id: m[2], name: m[1], animated: /^<a:/.test(s) };
  if (/\p{Extended_Pictographic}/u.test(s)) return { name: s };
  return undefined;
}

/** Normaliza cor para "#RRGGBB" (aceita #RGB/#RRGGBB, com/sem #). */
function normalizeHexColor(input?: string): string | undefined {
  const raw = (input ?? '').trim();
  if (!raw) return undefined;
  const core = raw.startsWith('#') ? raw.slice(1) : raw;
  const m3 = /^([0-9a-fA-F]{3})$/.exec(core);
  if (m3?.[1]) {
    const [r, g, b] = m3[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const m6 = /^([0-9a-fA-F]{6})$/.exec(core);
  if (m6?.[1]) return `#${m6[1]}`.toUpperCase();
  return undefined;
}

/** Converte "#RRGGBB" para inteiro 0xRRGGBB. */
function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** String segura pra TextDisplay (escapa markdown básico). */
function esc(s?: string | null) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|');
}

/** Monta as rows (select + botões) como JSON V2 puro. */
function buildClassesRowsV2(classes: Class[], selectedId?: string) {
  const options = (classes ?? []).slice(0, 25).map((c) => ({
    label: c.name,
    value: String(c.id),
    description: (c as any).roleId
      ? 'Vinculado a cargo'
      : (c as any).color
        ? `cor ${(c as any).color}`
        : undefined,
    emoji: toEmoji((c as any).emoji ?? undefined),
  }));

  const rowSelect = {
    type: V2.ActionRow,
    components: [
      {
        type: V2.StringSelect,
        custom_id: ids.recruit.settingsClasses, // mesmo id do botão; o router diferencia por tipo
        placeholder: classes.length ? 'Selecione uma classe' : 'Nenhuma classe configurada',
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
  } as const;

  const rowButtons = {
    type: V2.ActionRow,
    components: [
      {
        type: V2.Button,
        style: ButtonStyle.Secondary,
        custom_id: ids.recruit.classCreate,
        label: 'Adicionar Classe',
        emoji: { name: '➕' },
      },
      {
        type: V2.Button,
        style: ButtonStyle.Primary,
        custom_id: selectedId
          ? ids.recruit.classEdit(selectedId)
          : ids.recruit.classEdit('__selected__'),
        label: 'Editar Selecionada',
        emoji: { name: '✏️' },
        disabled: !selectedId,
      },
      {
        type: V2.Button,
        style: ButtonStyle.Danger,
        custom_id: selectedId
          ? ids.recruit.classRemove(selectedId)
          : ids.recruit.classRemove('__selected__'),
        label: 'Remover Selecionada',
        emoji: { name: '🗑️' },
        disabled: !selectedId,
      },
    ],
  } as const;

  return { rowSelect, rowButtons };
}

/** Renderiza a tela completa em V2 JSON sem usar ContainerBuilder. */
async function renderClassesSettingsV2(guildId: string, selectedId?: string) {
  const s = await recruitStore.getSettings(guildId);
  const classes = (recruitStore.parseClasses(s.classes) ?? []) as Class[];

  const lines = classes.length
    ? classes
      .map(
        (c: any) =>
          `• ${c.emoji ?? '▫️'} **${esc(c.name)}** ${c.roleId ? `(<@&${c.roleId}>)` : ''}${c.color ? ` — cor: \`${c.color}\`` : ''}`,
      )
      .join('\n')
    : '_Nenhuma classe configurada ainda._';

  const children: any[] = [];
  children.push({ type: V2.TextDisplay, content: '# Recrutamento — Gestão de Classes' });
  children.push({
    type: V2.TextDisplay,
    content: 'Adicione, edite ou remova classes. Cada classe pode ter cor e cargo vinculado.',
  });
  children.push({ type: V2.TextDisplay, content: lines });
  children.push({ type: V2.Separator, divider: true, spacing: 1 });

  const { rowSelect, rowButtons } = buildClassesRowsV2(classes, selectedId);
  children.push(rowSelect);
  children.push(rowButtons);

  // Botão voltar
  children.push({
    type: V2.ActionRow,
    components: [
      {
        type: V2.Button,
        style: ButtonStyle.Secondary,
        custom_id: 'recruit:settings',
        label: 'Voltar',
        emoji: { name: '↩️' },
      },
    ],
  });

  return {
    content: '', // Limpar conteúdo de texto se houver
    embeds: [], // 🚨 CRÍTICO: Limpar embeds antigos (incompatíveis com V2)
    flags: 1 << 15, // MessageFlags.IsComponentsV2
    components: [{ type: V2.Container, components: children }],
  } as const;
}

/* ----------------------- UI entry ----------------------- */

export async function openRecruitClassesSettings(inter: ButtonInteraction) {
  if (!inter.inCachedGuild()) return;

  try {
    // 1. Acknowledge immediately to prevent timeout
    if (!inter.deferred && !inter.replied) {
      await inter.deferUpdate();
    }

    // 2. Fetch data (can take > 3s)
    const payload = await renderClassesSettingsV2(inter.guildId!);

    // 3. Update the message
    await inter.editReply(payload);
  } catch (err: any) {
    console.error('Error opening classes settings:', err);
    try {
      const msg: any = { content: '❌ Erro ao abrir configurações de classes.', components: [], flags: MessageFlags.Ephemeral };
      if (inter.deferred || inter.replied) await inter.followUp(msg);
      else await inter.reply(msg);
    } catch {
      // ignore
    }
  }
}

/** Ao selecionar uma classe no SELECT, habilita os botões e injeta o id. */
export async function handleClassesSelect(inter: StringSelectMenuInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== ids.recruit.settingsClasses) return;
  const selected = inter.values && inter.values.length ? inter.values[0] : undefined;
  const payload = await renderClassesSettingsV2(inter.guildId!, selected);
  await inter.update(payload);
}

/* ----------------------- Modal de criar/editar ----------------------- */

export async function openClassModal(inter: ButtonInteraction, classId?: string) {
  if (!inter.inCachedGuild()) return;
  const s = await recruitStore.getSettings(inter.guildId);
  const classes = (recruitStore.parseClasses(s.classes) ?? []) as Class[];
  const editing = !!classId && classes.some((c) => c.id === classId);
  const toEdit: any | undefined = editing ? classes.find((c) => c.id === classId) : undefined;

  const modal = new ModalBuilder()
    .setCustomId(editing ? ids.recruit.modalClassUpdate(classId!) : ids.recruit.modalClassSave)
    .setTitle(editing ? `Editar Classe — ${toEdit?.name ?? ''}` : 'Nova Classe');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('name')
        .setLabel('Nome da Classe')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(60)
        .setValue(toEdit?.name ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('emoji')
        .setLabel('Emoji (unicode ou <:nome:id>)')
        .setRequired(false)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(64)
        .setValue(toEdit?.emoji ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Cor (#RRGGBB) - Cargo criado automaticamente')
        .setRequired(false)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(7)
        .setPlaceholder('#3498DB')
        .setValue((toEdit?.color as string | undefined) ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('roleId')
        .setLabel('ID do Cargo (deixe vazio para criar auto)')
        .setRequired(false)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(25)
        .setValue(toEdit?.roleId ?? ''),
    ),
  );

  await inter.showModal(modal);
}

// Helper local para parsear emojis (Unicode ou Custom)
function parseEmoji(raw: string) {
  const trimmed = raw.trim();
  // Regex para custom emoji: <:nome:ID> ou <a:nome:ID>
  const customMatch = trimmed.match(/<(a)?:(\w+):(\d+)>/);
  if (customMatch) {
    const isAnimated = !!customMatch[1];
    const name = customMatch[2];
    const id = customMatch[3];
    return {
      type: 'custom',
      name,
      id,
      url: `https://cdn.discordapp.com/emojis/${id}.png` // Role icons aceitam PNG/JPEG
    };
  }
  // Se for unicode (ex: 🛡️), não tem ID
  if (trimmed) {
    return { type: 'unicode', name: trimmed, id: undefined, url: undefined };
  }
  return null;
}

export async function handleClassModalSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild()) return;

  // 🚨 CRITICAL: Defer IMMEDIATELY to prevent "Unknown interaction" timeout
  await inter.deferReply({ flags: MessageFlags.Ephemeral });

  const isUpdate = ids.recruit.isModalClassUpdate(inter.customId);
  const classId = isUpdate ? inter.customId.split(':').pop()! : undefined;

  const nameRaw = (inter.fields.getTextInputValue('name') || '').trim();
  const emojiRaw = (inter.fields.getTextInputValue('emoji') || '').trim();
  let roleRaw = (inter.fields.getTextInputValue('roleId') || '').trim();
  const colorRaw = (inter.fields.getTextInputValue('color') || '').trim();

  if (!nameRaw) {
    await inter.editReply({ content: '❌ Nome é obrigatório.' });
    return;
  }

  const color = normalizeHexColor(colorRaw);
  if (colorRaw && !color) {
    await inter.editReply({ content: '❌ Cor inválida. Use o formato #RRGGBB (ex.: #FF8800).' });
    return;
  }

  // 🆕 CRIAÇÃO AUTOMÁTICA DE CARGO
  if (!roleRaw) {
    try {
      const colorInt = color ? hexToInt(color) : 0x99AAB5; // Cor padrão cinza Discord
      const emojiData = parseEmoji(emojiRaw);

      let createOptions: any = {
        name: nameRaw,
        color: colorInt,
        hoist: true,
        reason: 'Criação automática - Classe de recrutamento',
      };

      // Se for Custom Emoji e tiver URL -> tenta usar como ICON (requer Boost Nvl 2)
      if (emojiData?.type === 'custom' && emojiData.url) {
        createOptions.icon = emojiData.url;
      }
      // Se for Unicode Emoji -> usa unicodeEmoji (requer Boost Nvl 2)
      else if (emojiData?.type === 'unicode' && emojiData.name) {
        createOptions.unicodeEmoji = emojiData.name;
      }

      let newRole: any;
      try {
        newRole = await inter.guild?.roles.create(createOptions);
      } catch (err: any) {
        // Fallback: Se falhar (falta de boost/feature), tenta criar sem ícone
        if (err.message?.includes('boosts') || err.message?.includes('Missing Features') || err.code === 50035 || err.code === 50013) {

          // MELHORIA: Se for Emoji Unicode, coloca no NOME do cargo já que não deu para por como ícone
          let fallbackName = nameRaw;
          if (emojiData?.type === 'unicode' && emojiData.name) {
            fallbackName = `${emojiData.name} ${nameRaw}`;
          }

          newRole = await inter.guild?.roles.create({
            name: fallbackName,
            color: colorInt,
            hoist: true,
            reason: 'Criação automática (Fallback sem ícone) - Classe de recrutamento',
          });
        } else {
          throw err;
        }
      }

      if (newRole) {
        roleRaw = newRole.id;
        await inter.editReply({
          content: `✅ Cargo **${nameRaw}** criado automaticamente!\n🆔 ID: \`${newRole.id}\``
        });
      }
    } catch (err: any) {
      await inter.editReply({
        content: `❌ Falha ao criar cargo automaticamente.\n**Erro**: ${err.message || 'Desconhecido'}\n\nVerifique se o bot tem permissão \`MANAGE_ROLES\` e se o cargo do bot está acima na hierarquia.`
      });
      return;
    }
  }

  const s = await recruitStore.getSettings(inter.guildId);
  const classes = (recruitStore.parseClasses(s.classes) ?? []) as any[];

  if (isUpdate && classId) {
    const idx = classes.findIndex((c) => c.id === classId);
    if (idx >= 0) {
      classes[idx] = {
        id: classes[idx].id,
        name: nameRaw,
        emoji: emojiRaw || undefined,
        roleId: roleRaw || undefined,
        color: color || undefined,
      };
    }
  } else {
    classes.push({
      id: randomUUID(),
      name: nameRaw,
      emoji: emojiRaw || undefined,
      roleId: roleRaw || undefined,
      color: color || undefined,
    });
  }

  await recruitStore.updateSettings(inter.guildId, { classes });

  // Aplica cor no cargo, se possível (API nova)
  if (roleRaw && color) {
    try {
      const role =
        inter.guild?.roles?.cache?.get(roleRaw) ??
        (await inter.guild?.roles?.fetch(roleRaw).catch(() => null));
      const managed = (role as any)?.managed;
      const editable = (role as any)?.editable;
      if (role && !managed && editable) {
        const c = hexToInt(color);
        await (role as any)
          .setColors({ primaryColor: c }, 'Atualizado via Gestão de Classes')
          .catch(() => { });
      }
    } catch {
      // ignore
    }
  }

  // Atualiza painel público
  await publishPublicRecruitPanelV2(inter as any);

  // Atualiza a tela atual (mesma mensagem/container)
  const payload = await renderClassesSettingsV2(inter.guildId!, isUpdate ? classId : undefined);
  if (!inter.deferred && !inter.replied) await inter.deferReply({ flags: MessageFlags.Ephemeral });
  await inter.editReply(payload);

  await inter
    .followUp({ content: '✅ Classe salva.', flags: MessageFlags.Ephemeral })
    .catch(() => { });
}

/* ----------------------- Remoção ----------------------- */

export async function handleClassRemove(inter: ButtonInteraction, classId: string) {
  if (!inter.inCachedGuild()) return;

  const s = await recruitStore.getSettings(inter.guildId);
  const classes = (recruitStore.parseClasses(s.classes) ?? []) as any[];
  const filtered = classes.filter((c: any) => c.id !== classId);
  await recruitStore.updateSettings(inter.guildId, { classes: filtered });

  await publishPublicRecruitPanelV2(inter);

  const payload = await renderClassesSettingsV2(inter.guildId!);
  if (inter.deferred || inter.replied) await inter.editReply(payload);
  else await inter.update(payload);
}
