// src/ui/recruit/panel.ts
// Painel público (sem embed). Botão principal com emoji + label (claro), navegação opcional com ícones.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EMOJI } from '../icons.generated.js';
import { navRow } from '../common/icon-kit.js';
import { COLORS } from '../common/tokens.js';

// Tipagem mínima do que usamos de GuildConfig
export type GuildConfigLike = {
  panelTitle?: string | null;
  panelDesc?: string | null;
};

export function buildRecruitPanel(cfg: GuildConfigLike = {}) {
  const title = cfg.panelTitle?.trim() || 'Recrutamento';
  const desc  = cfg.panelDesc?.trim()  || 'Clique para começar sua candidatura.';

  // Botão principal — com label (fica mais claro pro público)
  const applyEmoji = EMOJI.actions.action_check;
  const primary = new ButtonBuilder()
    .setCustomId('recruit:apply')
    .setStyle(ButtonStyle.Success) // verde (ação afirmativa)
    .setEmoji({ id: applyEmoji.id, name: applyEmoji.name })
    .setLabel('Candidatar-se');

  const rowMain = new ActionRowBuilder<ButtonBuilder>().addComponents(primary);

  // Linha de navegação opcional (se quiser, pode comentar)
  const rowNav = navRow('recruit:panel', { back: false, next: false, refresh: true });

  // Sem embed: usamos texto formatado e componentes
  // (a cor do container não é customizável nativamente; cor de marca fica nos ícones/imagens e no Success/Danger)
  const header = `**${title}**`;
  const sub    = desc;

  return {
    content: `${header}\n${sub}`,
    // se um dia migrar pra V2, trocar para nosso asV2() e construir Containers/Sections.
    components: [rowMain, rowNav],
    allowedMentions: { parse: [] },
  };
}
