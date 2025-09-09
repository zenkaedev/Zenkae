// src/ui/recruit/settings.classe.ts — FULL
// ✅ V2 puro (sem misturar builders do Container V2 com JSON)
// ✅ Mesmos recursos: ID auto, cor da classe (#RRGGBB), aplicar cor no cargo, listagem, editar/remover
// ✅ Handlers: openRecruitClassesSettings, handleClassesSelect, openClassModal, handleClassModalSubmit, handleClassRemove
// ✅ Defensivo contra TS2532/TS2339
// ✅ Atualiza painel público após alterações

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
function toEmoji(input?: string | null): { id?: string; name?: string; animated?: boolean } | undefined {
  const s = (typeof input === 'string' ? input : '').trim();
  if (!s) return undefined;

  const m = /^<a?:(\w+):(\d+)>$/.exec(s);
  if (m && m[1] && m[2]) return { id: m[2], name: m[1], animated: /^<a:/.test(s) };
  if (/\p{Extended_Pictographic}/u.test(s)) return { name: s };
  return undefined;
}

/** Normaliza cor "#RRGGBB" (aceita com/sem #). */
function normalizeHexColor(input?: string): string | undefined {
  const raw = (input ?? '').trim();
  if (!raw) return undefined;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw);
  return m && m[1] ? `#${m[1].toUpperCase()}` : undefined;
}

/** String segura pra TextDisplay (escapa markdown básico). */
function esc(s?: string | null) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/`/g, '\\`').replace(/\|/g, '\\|');
}

/** Monta as rows (select + botões) como JSON V2 puro. */
function buildClassesRowsV2(classes: Class[], selectedId?: string) {
  const options = (classes ?? []).slice(0, 25).map((c) => ({
    label: c.name,
    value: String(c.id),
    description: (c as any).roleId ? 'Vinculado a cargo' : ((c as any).color ? `cor ${(c as any).color}` : undefined),
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
          : [{ label: 'Nenhuma classe configurada', value: 'void', description: 'Peça a um admin para configurar' }],
        disabled: !options.length,
      },
    ],
  } as const;

  const rowButtons = {
    type: V2.ActionRow,
    components: [
      { type: V2.Button, style: ButtonStyle.Secondary, custom_id: ids.recruit.classCreate, label: 'Adicionar Classe', emoji: { name: '➕' } },
      { type: V2.Button, style: ButtonStyle.Primary,   custom_id: selectedId ? ids.recruit.classEdit(selectedId)   : ids.recruit.classEdit('__selected__'),   label: 'Editar Selecionada',  emoji: { name: '✏️' }, disabled: !selectedId },
      { type: V2.Button, style: ButtonStyle.Danger,    custom_id: selectedId ? ids.recruit.classRemove(selectedId) : ids.recruit.classRemove('__selected__'), label: 'Remover Selecionada', emoji: { name: '🗑️' }, disabled: !selectedId },
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
        .map((c: any) => `• ${c.emoji ?? '▫️'} **${esc(c.name)}** ${c.roleId ? `(<@&${c.roleId}>)` : ''}${c.color ? ` — cor: \`${c.color}\`` : ''}`)
        .join('\n')
    : '_Nenhuma classe configurada ainda._';

  const children: any[] = [];
  children.push({ type: V2.TextDisplay, content: '# Recrutamento — Gestão de Classes' });
  children.push({ type: V2.TextDisplay, content: 'Adicione, edite ou remova classes. Cada classe pode ter cor e cargo vinculado.' });
  children.push({ type: V2.TextDisplay, content: lines });
  children.push({ type: V2.Separator, divider: true, spacing: 1 });

  const { rowSelect, rowButtons } = buildClassesRowsV2(classes, selectedId);
  children.push(rowSelect);
  children.push(rowButtons);

  // Botão voltar
  children.push({
    type: V2.ActionRow,
    components: [
      { type: V2.Button, style: ButtonStyle.Secondary, custom_id: 'recruit:settings', label: 'Voltar', emoji: { name: '↩️' } },
    ],
  });

  return {
    flags: 1 << 15, // MessageFlags.IsComponentsV2
    components: [ { type: V2.Container, components: children } ],
  } as const;
}

/* ----------------------- UI entry ----------------------- */

export async function openRecruitClassesSettings(inter: ButtonInteraction) {
  if (!inter.inCachedGuild()) return;
  const payload = await renderClassesSettingsV2(inter.guildId!);
  try {
    if (inter.deferred || inter.replied) {
      await inter.editReply(payload);
    } else {
      await inter.update(payload);
    }
  } catch {
    // fallback seguro
    try { await inter.reply({ ...(payload as any), flags: MessageFlags.Ephemeral } as any); } catch {}
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
      new TextInputBuilder().setCustomId('name').setLabel('Nome da Classe').setRequired(true).setStyle(TextInputStyle.Short).setMaxLength(60).setValue(toEdit?.name ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (unicode ou <:nome:id>)').setRequired(false).setStyle(TextInputStyle.Short).setMaxLength(64).setValue(toEdit?.emoji ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('roleId').setLabel('ID do Cargo (opcional)').setRequired(false).setStyle(TextInputStyle.Short).setMaxLength(25).setValue(toEdit?.roleId ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('color').setLabel('Cor da Classe (#RRGGBB opcional)').setRequired(false).setStyle(TextInputStyle.Short).setMaxLength(7).setValue((toEdit?.color as string | undefined) ?? ''),
    ),
  );

  await inter.showModal(modal);
}

export async function handleClassModalSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild()) return;

  const isUpdate = ids.recruit.isModalClassUpdate(inter.customId);
  const classId = isUpdate ? inter.customId.split(':').pop()! : undefined;

  const nameRaw  = (inter.fields.getTextInputValue('name')  || '').trim();
  const emojiRaw = (inter.fields.getTextInputValue('emoji') || '').trim();
  const roleRaw  = (inter.fields.getTextInputValue('roleId')|| '').trim();
  const colorRaw = (inter.fields.getTextInputValue('color') || '').trim();

  if (!nameRaw) {
    await replyV2Notice(inter, '❌ Nome é obrigatório.', true);
    return;
  }

  const color = normalizeHexColor(colorRaw);
  if (colorRaw && !color) {
    await replyV2Notice(inter, '❌ Cor inválida. Use o formato #RRGGBB (ex.: #FF8800).', true);
    return;
  }

  const s = await recruitStore.getSettings(inter.guildId);
  const classes = (recruitStore.parseClasses(s.classes) ?? []) as any[];

  if (isUpdate && classId) {
    const idx = classes.findIndex((c) => c.id === classId);
    if (idx >= 0) {
      classes[idx] = { id: classes[idx].id, name: nameRaw, emoji: emojiRaw || undefined, roleId: roleRaw || undefined, color: color || undefined };
    }
  } else {
    classes.push({ id: randomUUID(), name: nameRaw, emoji: emojiRaw || undefined, roleId: roleRaw || undefined, color: color || undefined });
  }

  await recruitStore.updateSettings(inter.guildId, { classes });

  // Aplica cor no cargo, se possível
  if (roleRaw && color) {
    try {
      const role = inter.guild?.roles?.cache?.get(roleRaw) ?? (await inter.guild?.roles?.fetch(roleRaw).catch(() => null));
      if (role && role.editable) await role.setColor(color as any, 'Atualizado via Gestão de Classes');
    } catch {}
  }

  // Atualiza painel público
  await publishPublicRecruitPanelV2(inter as any);

  // Atualiza a tela atual (mesma mensagem/container)
  const payload = await renderClassesSettingsV2(inter.guildId!, isUpdate ? classId : undefined);
  if (!inter.deferred && !inter.replied) await inter.deferReply({ flags: MessageFlags.Ephemeral });
  await inter.editReply(payload);

  await inter.followUp({ content: '✅ Classe salva.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
