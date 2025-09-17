// src/listeners/interactions.ts — FINAL (corrigido, premium, blindado)
import {
  Events,
  MessageFlags,
  type Client,
  type InteractionReplyOptions,
  type ModalSubmitInteraction,
} from 'discord.js';

import { renderDashboard, type DashTab } from '../container.js';
import { replyV2Notice } from '../ui/v2.js';
import { ids } from '../ui/ids.js';
import { assertStaff } from '../guards/staff.js';

// Classes (settings)
import {
  openRecruitClassesSettings,
  openClassModal,
  handleClassModalSubmit,
  handleClassRemove,
  handleClassesSelect,
} from '../ui/recruit/settings.classe.js';

// Recruit (fluxo antigo – mantido)
import {
  handlePublishRecruitPanel as handlePublishRecruitPanelLegacy,
  openApplyModal,
  handleApplyModalSubmit,
  openRecruitSettings,
  openEditFormModal,
  handleEditFormSubmit,
  openAppearanceModal,
  handleAppearanceSubmit,
  openDMTemplatesModal,
  handleDMTemplatesSubmit,
  openSelectPanelChannel,
  openSelectFormsChannel,
  handleSelectChannel,
  openApplyQuestionsModal,
  handleApplyQuestionsSubmit,
  handleDecisionApprove,
  handleDecisionRejectOpen,
  handleDecisionRejectSubmit,
} from '../modules/recruit/panel.js';

// Recruit público (NOVO V2)
import {
  publishPublicRecruitPanelV2,
  handleClassSelect,
  openNickModal,
  handleNickModalSubmit,
  handleStartClick,
  handleApplyQuestionsSubmit as handleApplyQuestionsSubmitPublic,
  PUB_IDS,
} from '../ui/recruit/panel.public.js';

// Events
import {
  openNewEventModal,
  handleNewEventSubmit,
  handleRsvpClick,
} from '../modules/events/panel.js';
import { cancelEvent, notifyConfirmed } from '../modules/events/staff.js';

// Activity
import { publishActivityPanel, handleActivityCheck } from '../modules/activity/panel.js';

// === POLL (NOVO) ===
import { executePoll } from '../commands/poll.js';
import { handlePollButton, handleCreatePollSubmit } from '../ui/poll/panel.js';
import { pollIds } from '../ui/poll/ids.js';

type RecruitFilter = 'all' | 'pending' | 'approved' | 'rejected';

/** ACK universal para modais (evita Unknown interaction 10062) */
async function ensureDeferredModal(i: ModalSubmitInteraction) {
  if (!i.isRepliable()) return;
  if (!i.deferred && !i.replied) {
    await i.deferReply({ ephemeral: true }).catch(() => {});
  }
}

/** Helper V2-safe: garante ACK rápido para botões/selects */
async function safeUpdate(interaction: any, base: InteractionReplyOptions | any) {
  try {
    if ((interaction.isButton?.() || interaction.isAnySelectMenu?.()) && interaction.isRepliable?.()) {
      if (!interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch {}
      }
      return await interaction.editReply(base as any);
    }
    if (interaction.deferred || interaction.replied) return await interaction.editReply(base as any);
    return await interaction.reply(base as any);
  } catch (err) {
    try { await replyV2Notice(interaction, '❌ Não foi possível atualizar a interface.', true); } catch {}
    throw err;
  }
}

export function registerInteractionRouter(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      /* ==================== /dashboard ==================== */
      if (interaction.isChatInputCommand() && interaction.commandName === 'dashboard') {
        const privado = interaction.options.getBoolean('privado') ?? false;
        const base = await renderDashboard({ tab: 'home', guildId: interaction.guildId ?? undefined });
        const reply: InteractionReplyOptions = {
          ...base,
          flags: (base.flags ?? 0) | (privado ? MessageFlags.Ephemeral : 0),
        };
        await interaction.reply(reply);
        return;
      }

      /* ==================== /poll ==================== */
      if (interaction.isChatInputCommand() && interaction.commandName === 'poll') {
        await executePoll(interaction as any);
        return;
      }

      /* ==================== Navegação dash ==================== */
      if (interaction.isButton() && ids.dash.is(interaction.customId)) {
        const parsed = ids.dash.parse(interaction.customId);
        if (!parsed) {
          await replyV2Notice(interaction, '❌ Aba inválida.', true);
          return;
        }
        const base = await renderDashboard({ tab: parsed.tab as DashTab, guildId: interaction.guildId ?? undefined });
        await safeUpdate(interaction, base);
        return;
      }

      /* ==================== Recruit ==================== */
      if (interaction.isStringSelectMenu() && interaction.customId === ids.recruit.filter) {
        const choice = interaction.values[0] as RecruitFilter;
        const base = await renderDashboard({ tab: 'recruit', guildId: interaction.guildId!, filter: choice });
        await safeUpdate(interaction, base);
        return;
      }

      if (interaction.isButton() && interaction.customId === ids.recruit.publish) {
        if (!(await assertStaff(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await publishPublicRecruitPanelV2(interaction);
        await interaction.editReply({ content: '✅ Painel de recrutamento publicado/atualizado.' });
        return;
      }

      if (interaction.isButton() && interaction.customId === ids.recruit.apply) {
        await openApplyModal(interaction); return;
      }
      if (interaction.isModalSubmit() && interaction.customId === 'recruit:apply:modal') {
        await ensureDeferredModal(interaction);
        await handleApplyModalSubmit(interaction); return;
      }
      if (interaction.isButton() && interaction.customId.startsWith('recruit:apply:q:open:')) {
        await openApplyQuestionsModal(interaction, interaction.customId.split(':').pop()!); return;
      }
      if (interaction.isModalSubmit() && interaction.customId.startsWith('recruit:apply:q:modal:')) {
        await ensureDeferredModal(interaction);
        await handleApplyQuestionsSubmit(interaction, interaction.customId.split(':').pop()!); return;
      }

      if (interaction.isButton() && interaction.customId === 'recruit:settings') {
        if (!(await assertStaff(interaction))) return; await openRecruitSettings(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsForm) {
        if (!(await assertStaff(interaction))) return; await openEditFormModal(interaction); return;
      }
      if (interaction.isModalSubmit() && interaction.customId === ids.recruit.modalForm) {
        if (!(await assertStaff(interaction))) return; await ensureDeferredModal(interaction);
        await handleEditFormSubmit(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsAppearance) {
        if (!(await assertStaff(interaction))) return; await openAppearanceModal(interaction); return;
      }
      if (interaction.isModalSubmit() && interaction.customId === ids.recruit.modalAppearance) {
        if (!(await assertStaff(interaction))) return; await ensureDeferredModal(interaction);
        await handleAppearanceSubmit(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsDM) {
        if (!(await assertStaff(interaction))) return; await openDMTemplatesModal(interaction); return;
      }
      if (interaction.isModalSubmit() && interaction.customId === ids.recruit.modalDM) {
        if (!(await assertStaff(interaction))) return; await ensureDeferredModal(interaction);
        await handleDMTemplatesSubmit(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsPanelChannel) {
        if (!(await assertStaff(interaction))) return; await openSelectPanelChannel(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsFormsChannel) {
        if (!(await assertStaff(interaction))) return; await openSelectFormsChannel(interaction); return;
      }
      if (interaction.isChannelSelectMenu() && interaction.customId === ids.recruit.selectPanelChannel) {
        if (!(await assertStaff(interaction))) return; await handleSelectChannel(interaction, 'panel'); return;
      }
      if (interaction.isChannelSelectMenu() && interaction.customId === ids.recruit.selectFormsChannel) {
        if (!(await assertStaff(interaction))) return; await handleSelectChannel(interaction, 'forms'); return;
      }

      // ===== Classes =====
      if (interaction.isStringSelectMenu() && interaction.customId === ids.recruit.settingsClasses) {
        if (!(await assertStaff(interaction))) return; await handleClassesSelect(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsClasses) {
        if (!(await assertStaff(interaction))) return; await openRecruitClassesSettings(interaction); return;
      }
      if (interaction.isButton() && ids.recruit.isClassEdit(interaction.customId)) {
        if (!(await assertStaff(interaction))) return; await openClassModal(interaction, interaction.customId.split(':').pop()!); return;
      }
      if (interaction.isButton() && ids.recruit.isClassRemove(interaction.customId)) {
        if (!(await assertStaff(interaction))) return; await handleClassRemove(interaction, interaction.customId.split(':').pop()!); return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.classCreate) {
        if (!(await assertStaff(interaction))) return; await openClassModal(interaction); return;
      }
      if (interaction.isModalSubmit() &&
        (interaction.customId === ids.recruit.modalClassSave || ids.recruit.isModalClassUpdate(interaction.customId))) {
        if (!(await assertStaff(interaction))) return; await ensureDeferredModal(interaction);
        await handleClassModalSubmit(interaction); return;
      }

      if (interaction.isButton() && ids.recruit.isApprove(interaction.customId)) {
        if (!(await assertStaff(interaction))) return; await handleDecisionApprove(interaction, interaction.customId.split(':').pop()!); return;
      }
      if (interaction.isButton() && ids.recruit.isReject(interaction.customId)) {
        if (!(await assertStaff(interaction))) return; await handleDecisionRejectOpen(interaction, interaction.customId.split(':').pop()!); return;
      }
      if (interaction.isModalSubmit() && interaction.customId.startsWith('recruit:decision:reject:modal:')) {
        if (!(await assertStaff(interaction))) return; await ensureDeferredModal(interaction);
        await handleDecisionRejectSubmit(interaction, interaction.customId.split(':').pop()!); return;
      }

      /* ==================== Recruit público V2 ==================== */
      if (interaction.isStringSelectMenu() && interaction.customId === PUB_IDS.classSelect) {
        await handleClassSelect(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === PUB_IDS.nickOpen) {
        await openNickModal(interaction); return;
      }
      if (interaction.isModalSubmit() && interaction.customId === PUB_IDS.nickModal) {
        await ensureDeferredModal(interaction); await handleNickModalSubmit(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === PUB_IDS.start) {
        await handleStartClick(interaction); return;
      }
      if (interaction.isModalSubmit() && interaction.customId.startsWith(PUB_IDS.applyQModalPrefix)) {
        await ensureDeferredModal(interaction); await handleApplyQuestionsSubmitPublic(interaction); return;
      }

      /* ==================== Events ==================== */
      if (interaction.isButton() && interaction.customId === ids.events.new) {
        if (!(await assertStaff(interaction))) return; await openNewEventModal(interaction); return;
      }
      if (interaction.isModalSubmit() && interaction.customId === 'events:new:modal') {
        if (!(await assertStaff(interaction))) return; await ensureDeferredModal(interaction);
        await handleNewEventSubmit(interaction); return;
      }
      if (interaction.isButton() && ids.events.isRsvp(interaction.customId)) {
        const parsed = ids.events.parseRsvp(interaction.customId);
        if (!parsed || !parsed.eventId) { await replyV2Notice(interaction, '❌ RSVP inválido.', true); return; }
        await handleRsvpClick(interaction, parsed.choice, parsed.eventId); return;
      }
      if (interaction.isButton() && ids.events.isNotify(interaction.customId)) {
        if (!(await assertStaff(interaction))) return;
        const n = ids.events.parseNotify(interaction.customId);
        if (!n || !n.eventId) { await replyV2Notice(interaction, '❌ Evento inválido.', true); return; }
        await notifyConfirmed(interaction, n.eventId); return;
      }
      if (interaction.isButton() && ids.events.isCancel(interaction.customId)) {
        if (!(await assertStaff(interaction))) return;
        const c = ids.events.parseCancel(interaction.customId);
        if (!c || !c.eventId) { await replyV2Notice(interaction, '❌ Evento inválido.', true); return; }
        await cancelEvent(interaction, c.eventId); return;
      }

      /* ==================== Activity ==================== */
      if (interaction.isButton() && interaction.customId === ids.activity.publish) {
        if (!(await assertStaff(interaction))) return; await publishActivityPanel(interaction); return;
      }
      if (interaction.isButton() && interaction.customId === ids.activity.check) {
        await handleActivityCheck(interaction); return;
      }

      /* ==================== Admin ==================== */
      if (interaction.isButton() && interaction.customId === ids.admin.clean) {
        await safeUpdate(interaction, { components: [] }); return;
      }

      /* ==================== Poll ==================== */
      if (interaction.isButton() && interaction.customId?.startsWith('poll:')) {
        try { await handlePollButton(interaction as any); }
        catch { await replyV2Notice(interaction, '❌ Erro ao processar ação da enquete.', true); }
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId === pollIds.createModal) {
        try { await ensureDeferredModal(interaction); await handleCreatePollSubmit(interaction as any); }
        catch { await replyV2Notice(interaction, '❌ Erro ao processar formulário da enquete.', true); }
        return;
      }
    } catch (err) {
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await replyV2Notice(interaction, '❌ Ocorreu um erro ao processar.', true);
        }
      } catch {}
      console.error('[interaction router] erro:', err);
    }
  });
}
