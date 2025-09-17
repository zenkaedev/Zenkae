// src/bot/interaction.public-recruit.ts
// Router auxiliar — plugue no seu client.on('interactionCreate') sem mexer no router atual.

// 🔧 path ajustado para onde você colocou o painel (ui/recruit):
import {
  publishPublicRecruitPanelV2,
  handleClassSelect,
  openNickModal,
  handleNickModalSubmit,
  handleStartClick,
  handleApplyQuestionsSubmit,
  PUB_IDS,
} from '../ui/recruit/panel.public.js';

export async function routePublicRecruit(i: any) {
  try {
    if (i.isChatInputCommand?.() && i.commandName === 'recruit' && i.options?.getSubcommand?.(false) === 'publishV2') {
      await publishPublicRecruitPanelV2(i);
      return true;
    }
    if (i.isStringSelectMenu?.() && i.customId === PUB_IDS.classSelect) return await handleClassSelect(i);
    if (i.isButton?.()) {
      if (i.customId === PUB_IDS.nickOpen) return await openNickModal(i);
      if (i.customId === PUB_IDS.start) return await handleStartClick(i);
    }
    if (i.isModalSubmit?.()) {
      if (i.customId === PUB_IDS.nickModal) return await handleNickModalSubmit(i);
      if (i.customId.startsWith(PUB_IDS.applyQModalPrefix)) return await handleApplyQuestionsSubmit(i);
    }
  } catch (e) {
    console.error('[routePublicRecruit] error:', e);
  }
  return false;
}
