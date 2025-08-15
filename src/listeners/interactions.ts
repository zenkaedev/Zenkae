// src/listeners/interactions.ts
import {
  Events,
  MessageFlags,
  type Client,
  type InteractionReplyOptions,
} from 'discord.js';

import { renderDashboard, type DashTab } from '../ui/container';
import { replyV2Notice } from '../ui/v2';
import { ids } from '../ui/ids';
import { assertStaff } from '../guards/staff';

/* ------------------------- RECRUIT ------------------------- */
import {
  // painel público
  handlePublishRecruitPanel,
  openApplyModal,
  handleApplyModalSubmit,
  // settings
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
  // Q&A extra
  openApplyQuestionsModal,
  handleApplyQuestionsSubmit,
  // decisões
  handleDecisionApprove,
  handleDecisionRejectOpen,
  handleDecisionRejectSubmit,
} from '../modules/recruit/panel';

/* ------------------------- EVENTS ------------------------- */
import {
  openNewEventModal,
  handleNewEventSubmit,
  handleRsvpClick,
} from '../modules/events/panel';
import { cancelEvent, notifyConfirmed } from '../modules/events/staff';

/* ------------------------ ACTIVITY ------------------------ */
import {
  publishActivityPanel,
  handleActivityCheck,
} from '../modules/activity/panel';

/** Mantém local para evitar import quebrado */
type RecruitFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function registerInteractionRouter(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      /* ==================================================
       *                    /dashboard
       * ================================================== */
      if (interaction.isChatInputCommand() && interaction.commandName === 'dashboard') {
        const privado = interaction.options.getBoolean('privado') ?? false;
        const base = await renderDashboard({
          tab: 'home',
          guildId: interaction.guildId ?? undefined,
        });

        const reply: InteractionReplyOptions = {
          ...base,
          // Components V2 + Ephemeral por flags
          flags: (base.flags ?? 0) | (privado ? MessageFlags.Ephemeral : 0),
        };
        await interaction.reply(reply);
        return;
      }

      /* ==================================================
       *                Navegação principal (dash)
       * ================================================== */
      if (interaction.isButton() && ids.dash.is(interaction.customId)) {
        const parsed = ids.dash.parse(interaction.customId);
        if (!parsed) {
          await replyV2Notice(interaction, '❌ Aba inválida.', true);
          return;
        }
        const tab = parsed.tab as DashTab;
        const base = await renderDashboard({
          tab,
          guildId: interaction.guildId ?? undefined,
        });
        await interaction.update(base);
        return;
      }

      /* ==================================================
       *                      RECRUIT
       * ================================================== */

      // filtro da aba recruit
      if (interaction.isStringSelectMenu() && interaction.customId === ids.recruit.filter) {
        const choice = interaction.values[0] as RecruitFilter;
        const base = await renderDashboard({
          tab: 'recruit',
          guildId: interaction.guildId!,
          filter: choice,
        });
        await interaction.update(base);
        return;
      }

      // publicar painel público
      if (interaction.isButton() && interaction.customId === ids.recruit.publish) {
        if (!(await assertStaff(interaction))) return;
        await handlePublishRecruitPanel(interaction);
        return;
      }

      // abrir modal de candidatura (nick/classe)
      if (interaction.isButton() && interaction.customId === ids.recruit.apply) {
        await openApplyModal(interaction);
        return;
      }

      // submit do primeiro modal (nick/classe)
      if (interaction.isModalSubmit() && interaction.customId === 'recruit:apply:modal') {
        await handleApplyModalSubmit(interaction);
        return;
      }

      // botão para abrir 2º modal (Q&A)
      if (interaction.isButton() && interaction.customId.startsWith('recruit:apply:q:open:')) {
        const appId = interaction.customId.split(':').pop() as string;
        await openApplyQuestionsModal(interaction, appId);
        return;
      }

      // submit do 2º modal (Q&A)
      if (interaction.isModalSubmit() && interaction.customId.startsWith('recruit:apply:q:modal:')) {
        const appId = interaction.customId.split(':').pop() as string;
        await handleApplyQuestionsSubmit(interaction, appId);
        return;
      }

      /* -------- Recruit Settings (Dashboard → Recrutamento) -------- */

      // atalho opcional para abrir tela de configurações
      if (interaction.isButton() && interaction.customId === 'recruit:settings') {
        if (!(await assertStaff(interaction))) return;
        await openRecruitSettings(interaction);
        return;
      }

      // editar formulário
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsForm) {
        if (!(await assertStaff(interaction))) return;
        await openEditFormModal(interaction);
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId === ids.recruit.modalForm) {
        if (!(await assertStaff(interaction))) return;
        await handleEditFormSubmit(interaction);
        return;
      }

      // aparência
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsAppearance) {
        if (!(await assertStaff(interaction))) return;
        await openAppearanceModal(interaction);
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId === ids.recruit.modalAppearance) {
        if (!(await assertStaff(interaction))) return;
        await handleAppearanceSubmit(interaction);
        return;
      }

      // DM Templates
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsDM) {
        if (!(await assertStaff(interaction))) return;
        await openDMTemplatesModal(interaction);
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId === ids.recruit.modalDM) {
        if (!(await assertStaff(interaction))) return;
        await handleDMTemplatesSubmit(interaction);
        return;
      }

      // canais (painel / formulários)
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsPanelChannel) {
        if (!(await assertStaff(interaction))) return;
        await openSelectPanelChannel(interaction);
        return;
      }
      if (interaction.isButton() && interaction.customId === ids.recruit.settingsFormsChannel) {
        if (!(await assertStaff(interaction))) return;
        await openSelectFormsChannel(interaction);
        return;
      }
      if (interaction.isChannelSelectMenu() && interaction.customId === ids.recruit.selectPanelChannel) {
        if (!(await assertStaff(interaction))) return;
        await handleSelectChannel(interaction, 'panel');
        return;
      }
      if (interaction.isChannelSelectMenu() && interaction.customId === ids.recruit.selectFormsChannel) {
        if (!(await assertStaff(interaction))) return;
        await handleSelectChannel(interaction, 'forms');
        return;
      }

      // decisões (aprovar/recusar)
      if (interaction.isButton() && ids.recruit.isApprove(interaction.customId)) {
        if (!(await assertStaff(interaction))) return;
        const appId = interaction.customId.split(':').pop() as string;
        await handleDecisionApprove(interaction, appId);
        return;
      }
      if (interaction.isButton() && ids.recruit.isReject(interaction.customId)) {
        if (!(await assertStaff(interaction))) return;
        const appId = interaction.customId.split(':').pop() as string;
        await handleDecisionRejectOpen(interaction, appId);
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId.startsWith('recruit:decision:reject:modal:')) {
        if (!(await assertStaff(interaction))) return;
        const appId = interaction.customId.split(':').pop() as string;
        await handleDecisionRejectSubmit(interaction, appId);
        return;
      }

      /* ==================================================
       *                      EVENTS
       * ================================================== */
      if (interaction.isButton() && interaction.customId === ids.events.new) {
        if (!(await assertStaff(interaction))) return;
        await openNewEventModal(interaction);
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId === 'events:new:modal') {
        if (!(await assertStaff(interaction))) return;
        await handleNewEventSubmit(interaction);
        return;
      }

      // RSVP
      if (interaction.isButton() && ids.events.isRsvp(interaction.customId)) {
        const parsed = ids.events.parseRsvp(interaction.customId);
        if (!parsed || !parsed.eventId) {
          await replyV2Notice(interaction, '❌ RSVP inválido.', true);
          return;
        }
        await handleRsvpClick(interaction, parsed.choice, parsed.eventId);
        return;
      }

      // notificar confirmados
      if (interaction.isButton() && ids.events.isNotify(interaction.customId)) {
        if (!(await assertStaff(interaction))) return;
        const n = ids.events.parseNotify(interaction.customId);
        if (!n || !n.eventId) {
          await replyV2Notice(interaction, '❌ Evento inválido.', true);
          return;
        }
        await notifyConfirmed(interaction, n.eventId);
        return;
      }

      // cancelar evento
      if (interaction.isButton() && ids.events.isCancel(interaction.customId)) {
        if (!(await assertStaff(interaction))) return;
        const c = ids.events.parseCancel(interaction.customId);
        if (!c || !c.eventId) {
          await replyV2Notice(interaction, '❌ Evento inválido.', true);
          return;
        }
        await cancelEvent(interaction, c.eventId);
        return;
      }

      /* ==================================================
       *                     ACTIVITY
       * ================================================== */
      if (interaction.isButton() && interaction.customId === ids.activity.publish) {
        if (!(await assertStaff(interaction))) return;
        await publishActivityPanel(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId === ids.activity.check) {
        await handleActivityCheck(interaction);
        return;
      }

      /* ==================================================
       *                      ADMIN
       * ================================================== */
      if (interaction.isButton() && interaction.customId === ids.admin.clean) {
        await interaction.update({ components: [] });
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
