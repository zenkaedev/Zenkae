// src/ui/recruit/classes.ui.ts
// UI de gerenciamento de classes (NOVO) — CRUD simples via modais/lista.

import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';

// 🔧 path ajustado:
import { recruitStore } from '../../modules/recruit/store.js';

const IDS = {
  open: 'recruit:classes:open',
  addOpen: 'recruit:classes:add:open',
  addModal: 'recruit:classes:add:modal',
};

const V2 = {
  ActionRow: 1,
  Button: 2,
  Section: 9,
  TextDisplay: 10,
  Separator: 14,
  Container: 17,
} as const;

function esc(s?: string | null) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|');
}

export async function openClassesUI(inter: ButtonInteraction) {
  if (!inter.inCachedGuild()) return;
  const guildId = inter.guildId!;
  const s = await recruitStore.getSettings(guildId);
  const classes = (s as any).classes ?? [];

  const list =
    classes
      .map(
        (c: any, i: number) =>
          `${i + 1}. ${c.emoji ? `${c.emoji} ` : ''}**${esc(c.name)}**` +
          `${c.roleId ? ` — <@&${c.roleId}>` : ''}` +
          `${c.color ? ` — #${c.color.toString(16).padStart(6, '0')}` : ''}`,
      )
      .join('\n') || '_Nenhuma classe cadastrada_';

  await inter.update({
    flags: 1 << 15,
    components: [
      {
        type: V2.Container,
        accent_color: (s as any).appearanceAccent ?? 0x3D348B,
        components: [
          { type: V2.TextDisplay, content: '# Gerenciar Classes' },
          { type: V2.TextDisplay, content: list },
          { type: V2.Separator, divider: true, spacing: 1 },
          { type: V2.TextDisplay, content: 'Use o botão abaixo para adicionar.' },
        ],
      },
      {
        type: V2.ActionRow,
        components: [{ type: 2, style: ButtonStyle.Success, custom_id: IDS.addOpen, label: 'Adicionar classe' }],
      },
    ],
  } as any);
}

export async function openAddClassModal(inter: ButtonInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== IDS.addOpen) return false;

  const m = new ModalBuilder().setCustomId(IDS.addModal).setTitle('Adicionar classe');
  m.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Nome*').setRequired(true).setStyle(TextInputStyle.Short),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (opcional)').setRequired(false).setStyle(TextInputStyle.Short),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Cor (hex, opcional) ex.: #3D348B')
        .setRequired(false)
        .setStyle(TextInputStyle.Short),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('roleId').setLabel('Role ID (opcional)').setRequired(false).setStyle(TextInputStyle.Short),
    ),
  );
  await inter.showModal(m);
  return true;
}

export async function handleAddClassModal(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild() || inter.customId !== IDS.addModal) return false;
  const guildId = inter.guildId!;

  const name = (inter.fields.getTextInputValue('name') || '').trim();
  const emoji = (inter.fields.getTextInputValue('emoji') || '').trim() || null;
  const colorHex = (inter.fields.getTextInputValue('color') || '').trim();
  const roleId = (inter.fields.getTextInputValue('roleId') || '').trim() || null;

  if (!name) {
    await inter.reply({ flags: MessageFlags.Ephemeral
, content: '❌ Nome é obrigatório.' });
    return true;
  }

  let color: number | null = null;
  if (colorHex) {
    const hex = colorHex.replace('#', '');
    const n = parseInt(hex, 16);
    if (!Number.isNaN(n) && n >= 0x000000 && n <= 0xffffff) color = n;
  }

  const s = await recruitStore.getSettings(guildId);
  const nextClasses = [...((s as any).classes ?? []), { id: cryptoRandom(), name, emoji, color, roleId }];
  await recruitStore.updateSettings(guildId, { ...(s as any), classes: nextClasses });

  await inter.reply({ flags: MessageFlags.Ephemeral
, content: `✅ Classe **${name}** adicionada.` });
  return true;
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
