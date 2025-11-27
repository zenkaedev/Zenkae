// src/ui/setup/home.ts
// Card "Configurações" com hierarquia visual, divisórias e botões só-ícone.
// Usa nossa paleta/tokens e os emojis gerados.

import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { COLORS } from '../common/tokens.js';
import { EMOJI } from '../icons.generated.js';
import { iconButton } from '../common/icon-kit.js';

export function buildSetupHome() {
  // Header estilizado (título forte + ícone de engrenagem)
  const gear = EMOJI.others.other_gear.markup;
  const header = `${gear} **Configurações**\n` + monoDivider(COLORS.primary) + '\n';

  // Subtexto orientativo (respira entre blocos)
  const lead =
    'Escolha abaixo o que deseja configurar:\n' +
    bullet(
      'Canais',
      '🌐 Canal global',
      '🔍 Canal de dúvidas',
      '🗂️ Canal de gerenciamento',
      '📜 Canal de logs',
      '💡 Canal de sugestões',
    ) +
    '\n' +
    bullet('Cargos', '👥 Cargo da staff') +
    '\n' +
    bullet('Webhooks', '🔗 Integrações / logs externos') +
    '\n' +
    lightNote('Dica: você pode voltar a esta tela a qualquer momento.');

  // Botões só-ícone (padrão cinza). IDs: setup:channels / setup:roles / setup:webhooks
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    iconButton('setup:channels', 'files.file_files', 'neutral'),
    iconButton('setup:roles', 'user.user_cog', 'neutral'),
    iconButton('setup:webhooks', 'code.code_terminal', 'neutral'),
  );

  // Rodapé discreto
  const footer = `\n${hairDivider()} \n${muted('Configurações do Zenkae — padrão visual aplicado')}`;

  return {
    // Components v1 (content + rows). Quando migrarmos p/ V2, a gente troca por asV2(container/sections).
    content: header + lead + footer,
    components: [row],
    allowedMentions: { parse: [] },
  };
}

// ---------- helpers visuais (texto) ----------
function bullet(title: string, ...items: string[]) {
  const list = items.map((i) => `• ${i}`).join('\n');
  return `**# ${title}**\n${list}`;
}

function muted(s: string) {
  return `*${s}*`;
}

function lightNote(s: string) {
  return `*${s}*`;
}

function hairDivider() {
  return '─'.repeat(30);
}

// “Divider” com bloco de cor simulada (marca visual da paleta)
function monoDivider(_hex: number) {
  // Não dá pra pintar background no Discord; a barra abaixo é só estética/consistência.
  return '━'.repeat(18);
}
