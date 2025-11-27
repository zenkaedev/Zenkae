// src/ui/common/icon-kit.ts
// Helpers p/ usar os emojis gerados (src/ui/icons.generated.ts) em botões só-ícone.
// Regras: neutro = cinza (Secondary), confirmar = verde (Success), recusar = vermelho (Danger).

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EMOJI } from '../icons.generated.js';

type Group = keyof typeof EMOJI;
export type EmojiPath = `${Group}.${string}`;

export function getEmoji(path: EmojiPath) {
  const [g, k] = path.split('.') as [Group, string];
  const group = (EMOJI as any)[g];
  const entry = group?.[k];
  if (!entry) throw new Error(`Emoji não encontrado: ${path}`);
  return { id: String(entry.id), name: String(entry.name) };
}

export type IconVariant = 'neutral' | 'ok' | 'danger' | 'primary';
function toStyle(v: IconVariant): ButtonStyle {
  switch (v) {
    case 'ok':
      return ButtonStyle.Success; // verde (afirma)
    case 'danger':
      return ButtonStyle.Danger; // vermelho (nega)
    case 'primary':
      return ButtonStyle.Primary; // azul Discord (usar pouco)
    default:
      return ButtonStyle.Secondary; // cinza (padrão)
  }
}

// Botão só-ícone (sem label)
export function iconButton(
  customId: string,
  emojiPath: EmojiPath,
  variant: IconVariant = 'neutral',
) {
  const e = getEmoji(emojiPath);
  return new ButtonBuilder()
    .setCustomId(customId)
    .setStyle(toStyle(variant))
    .setEmoji({ id: e.id, name: e.name });
}

// Linhas prontas
export function navRow(
  baseId: string,
  opts: { back?: boolean; refresh?: boolean; next?: boolean; upDown?: boolean } = {},
) {
  const items: ButtonBuilder[] = [];
  if (opts.back ?? true)
    items.push(iconButton(`${baseId}:back`, 'navigation.arrow_back', 'neutral'));
  if (opts.refresh ?? true)
    items.push(iconButton(`${baseId}:refresh`, 'navigation.arrow_refresh', 'neutral'));
  if (opts.next ?? true)
    items.push(iconButton(`${baseId}:next`, 'navigation.arrow_next', 'neutral'));
  if (opts.upDown) {
    items.push(iconButton(`${baseId}:up`, 'navigation.arrow_up', 'neutral'));
    items.push(iconButton(`${baseId}:down`, 'navigation.arrow_down', 'neutral'));
  }
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...items);
}

export function approveRejectRow(
  baseId: string,
  emojiOk: EmojiPath = 'actions.action_check',
  emojiX: EmojiPath = 'actions.action_x',
) {
  const ok = iconButton(`${baseId}:approve`, emojiOk, 'ok');
  const no = iconButton(`${baseId}:reject`, emojiX, 'danger');
  return new ActionRowBuilder<ButtonBuilder>().addComponents(ok, no);
}

// Alias rápidos
export const ICON = {
  nav: {
    back: 'navigation.arrow_back' as const,
    next: 'navigation.arrow_next' as const,
    refresh: 'navigation.arrow_refresh' as const,
    up: 'navigation.arrow_up' as const,
    down: 'navigation.arrow_down' as const,
  },
  confirm: 'actions.action_check' as const,
  cancel: 'actions.action_x' as const,
  save: 'others.other_save' as const,
  trash: 'others.other_trash' as const,
  gear: 'others.other_gear' as const,
};
