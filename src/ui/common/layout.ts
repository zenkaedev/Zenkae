// src/ui/common/layout.ts
// UI minimalista (sem embeds) + builder do painel de recrutamento
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type APIActionRowComponent,
  type APIButtonComponent,
} from 'discord.js';

export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  danger: 0xed4245,
  warning: 0xfee75c,
  neutral: 0x2b2d31,
} as const;

export const EMOJI = {
  apply: '🟩',
  approve: '✅',
  reject: '🛑',
  interview: '📅',
} as const;

// Stub para “Components v2”: hoje só garantimos que não há embeds.
export function asV2<T extends { content?: string; embeds?: any[]; components?: any; flags?: number }>(payload: T): T {
  if (payload.embeds && payload.embeds.length) {
    throw new Error('Components v2: não use embeds neste payload.');
  }
  return payload;
}

// Helpers simples para montar linhas de botões
export function actions(...buttons: ButtonBuilder[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

export function button(id: string, label: string, style: 'primary'|'secondary'|'success'|'danger', emoji?: string) {
  const styleMap: Record<typeof style, ButtonStyle> = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
  } as any;
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(styleMap[style]);
  if (emoji) b.setEmoji(emoji);
  return b;
}

// Builder do painel público de recrutamento
export function buildRecruitPanel(config?: {
  panelTitle?: string | null;
  panelDesc?: string | null;
  // image/thumb/accent podem vir depois; mantemos sem embeds por V2
}) {
  const title = (config?.panelTitle || 'Recrutamento').trim();
  const desc = (config?.panelDesc || 'Clique para começar sua candidatura.').trim();

  const row = actions(
    button('recruit:apply', 'Candidatar-se', 'success', EMOJI.apply),
  );

  // Mantemos content com título + descrição (sem embeds)
  const content = `**${title}**\n${desc}`;

  // Retorna no formato aceito por reply/send do discord.js
  return asV2({
    content,
    components: [row.toJSON() as APIActionRowComponent<APIButtonComponent>],
  });
}
