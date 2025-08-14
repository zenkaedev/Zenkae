import type {
  Interaction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import type { AppCtx } from "../../core/ctx";
import {
  DASH,
  renderDashHome,
  renderRecruitMenu,
  renderEventsMenu,
  renderEngageMenu,
  renderAdminMenu,
} from "../../ui/dashboard/home";

/**
 * Regras:
 * - Clique em botão/seleção -> UPDATE no mesmo container (interaction.update).
 * - Se a render demorar (DB etc.), use deferUpdate() e depois editReply(view).
 * - Slash /dashboard responde a primeira vez (reply efêmero) noutro arquivo.
 */

export const dashboardRouter = {
  match(id: string) {
    return id.startsWith("dash:");
  },

  async handle(
    ix: Interaction | MessageComponentInteraction | ModalSubmitInteraction,
    _ctx: AppCtx
  ) {
    // Só tratamos componentes/modais aqui.
    if (ix.isChatInputCommand?.()) return;

    // ---------- HOME ----------
    if (ix.isButton() && (ix.customId === DASH.NAV_HOME || ix.customId === "dash:open")) {
      // Render leve: pode atualizar direto
      const view = renderDashHome();
      await ix.update(view).catch(async () => {
        // fallback, caso já tenha sido respondido/expirado
        await ix.deferUpdate().catch(() => {});
        await ix.editReply(view).catch(() => {});
      });
      return;
    }

    // ---------- NAVEGAÇÃO ENTRE MÓDULOS ----------
    if (ix.isButton() && ix.customId === DASH.NAV_RECRUIT) {
      const view = renderRecruitMenu();
      await ix.update(view).catch(async () => {
        await ix.deferUpdate().catch(() => {});
        await ix.editReply(view).catch(() => {});
      });
      return;
    }

    if (ix.isButton() && ix.customId === DASH.NAV_EVENTS) {
      const view = renderEventsMenu();
      await ix.update(view).catch(async () => {
        await ix.deferUpdate().catch(() => {});
        await ix.editReply(view).catch(() => {});
      });
      return;
    }

    if (ix.isButton() && ix.customId === DASH.NAV_ENGAGE) {
      const view = renderEngageMenu();
      await ix.update(view).catch(async () => {
        await ix.deferUpdate().catch(() => {});
        await ix.editReply(view).catch(() => {});
      });
      return;
    }

    if (ix.isButton() && ix.customId === DASH.NAV_ADMIN) {
      const view = renderAdminMenu();
      await ix.update(view).catch(async () => {
        await ix.deferUpdate().catch(() => {});
        await ix.editReply(view).catch(() => {});
      });
      return;
    }

    // ---------- PLACEHOLDERS DAS AÇÕES (ATUALIZAM O MESMO CONTAINER) ----------
    if (ix.isButton()) {
      const label = {
        [DASH.RECRUIT_EDIT_CLASSES]: "🛠️ [Recrutamento] Editor de Classes (em breve)",
        [DASH.RECRUIT_EDIT_FORM]: "🛠️ [Recrutamento] Editor de Formulário (em breve)",
        [DASH.RECRUIT_APPEARANCE]: "🛠️ [Recrutamento] Aparência do Painel (em breve)",
        [DASH.EVENTS_CREATE]: "🛠️ [Eventos] Criar Evento (em breve)",
        [DASH.EVENTS_EDIT]: "🛠️ [Eventos] Editar Evento (em breve)",
        [DASH.EVENTS_LIST]: "🛠️ [Eventos] Listar Eventos (em breve)",
        [DASH.ENGAGE_VOTES]: "🛠️ [Engajamento] Votações (em breve)",
        [DASH.ENGAGE_SUGGESTIONS]: "🛠️ [Engajamento] Sugestões (em breve)",
        [DASH.ENGAGE_RANKING]: "🛠️ [Engajamento] Ranking (em breve)",
        [DASH.ADMIN_ROLES]: "🛠️ [Admin] Cargos (em breve)",
        [DASH.ADMIN_ANNOUNCEMENTS]: "🛠️ [Admin] Anúncios (em breve)",
        [DASH.ADMIN_INACTIVE]: "🛠️ [Admin] Inativos (em breve)",
      } as Record<string, string>;

      // Atualiza o container atual com uma mensagem curta
      await ix.update({ content: label[ix.customId] ?? "🛠️ Em construção…", components: [] }).catch(async () => {
        await ix.deferUpdate().catch(() => {});
        await ix.editReply({ content: label[ix.customId] ?? "🛠️ Em construção…", components: [] }).catch(() => {});
      });
      return;
    }

    // ---------- SUBMISSÕES DE MODAL ----------
    if (ix.isModalSubmit()) {
      // Para modal submit, reconhecemos/fechamos com deferUpdate() e
      // depois editamos o container original se necessário.
      await ix.deferUpdate().catch(() => {});
      // Exemplo: voltar pra home depois do modal (ajuste conforme tua UX)
      const view = renderDashHome();
      await ix.editReply(view).catch(() => {});
      return;
    }
  },
};
