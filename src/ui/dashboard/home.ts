import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * UI-first (sem embed):
 * - Banner opcional (anexo local ou URL) no topo.
 * - Conteúdo hierárquico (título > descrição > seções).
 * - Divisores e respiro.
 *
 * Para usar banner local, coloque uma imagem em:
 *   ./assets/banners/dashboard.png
 * ou mude a constante BANNER_PATH abaixo. Se não existir, ignora.
 */

const BANNER_PATH: string | null = "./assets/banners/dashboard.png"; // defina null para sem banner

const HR = "╍".repeat(44);
const GAP = "\n";
const GAP2 = "\n\n";
const bullet = (t: string) => `• ${t}`;

// IDs de navegação/ações
export const DASH = {
  NAV_HOME: "dash:nav:home",

  NAV_RECRUIT: "dash:nav:recruit",
  RECRUIT_EDIT_CLASSES: "dash:recruit:edit-classes",
  RECRUIT_EDIT_FORM: "dash:recruit:edit-form",
  RECRUIT_APPEARANCE: "dash:recruit:appearance",

  NAV_EVENTS: "dash:nav:events",
  EVENTS_CREATE: "dash:events:create",
  EVENTS_EDIT: "dash:events:edit",
  EVENTS_LIST: "dash:events:list",

  NAV_ENGAGE: "dash:nav:engage",
  ENGAGE_VOTES: "dash:engage:votes",
  ENGAGE_SUGGESTIONS: "dash:engage:suggestions",
  ENGAGE_RANKING: "dash:engage:ranking",

  NAV_ADMIN: "dash:nav:admin",
  ADMIN_ROLES: "dash:admin:roles",
  ADMIN_ANNOUNCEMENTS: "dash:admin:announcements",
  ADMIN_INACTIVE: "dash:admin:inactive",
} as const;

/* ---------- helpers ---------- */
function isUrl(s: string) {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}
function maybeBanner(path: string | null | undefined) {
  if (!path) return { lines: [] as string[], files: undefined as any };

  if (isUrl(path)) {
    // URL externa: deixa o link acima do conteúdo (Discord faz preview)
    return { lines: [path, ""], files: undefined };
  }

  const abs = resolve(path);
  if (existsSync(abs)) {
    const file = new AttachmentBuilder(abs).setName("dashboard-banner.png");
    return { lines: [] as string[], files: [file] };
  }

  // arquivo não existe: não anexa nada (evita ENOENT)
  return { lines: [] as string[], files: undefined };
}

const row = (...btns: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...btns);

/* ---------- HOME ---------- */
export function renderDashHome() {
  const { lines: bannerLines, files } = maybeBanner(BANNER_PATH);

  const content =
    [
      ...bannerLines,
      "💠 **Painel de Controle do Zenkae Bot**",
      "Gerencie tudo por aqui, de forma rápida e sem poluir o canal.",
      HR,
      bullet("**Recrutamento** — classes, formulário, aparência"),
      bullet("**Eventos** — criar, editar, listar"),
      bullet("**Engajamento** — votações, sugestões, ranking"),
      bullet("**Administração** — cargos, anúncios, inativos"),
      GAP2,
      "_Escolha um módulo para começar._",
    ].join("\n");

  const actions = row(
    new ButtonBuilder().setCustomId(DASH.NAV_RECRUIT).setLabel("Recrutamento").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(DASH.NAV_EVENTS).setLabel("Eventos").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(DASH.NAV_ENGAGE).setLabel("Engajamento").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(DASH.NAV_ADMIN).setLabel("Administração").setStyle(ButtonStyle.Secondary),
  );

  return { content, components: [actions], files } as const;
}

/* ---------- SUBMENUS + VOLTAR ---------- */
export function renderBackRow() {
  return [row(new ButtonBuilder().setCustomId(DASH.NAV_HOME).setLabel("Voltar").setStyle(ButtonStyle.Secondary))] as const;
}

export function renderRecruitMenu() {
  const content =
    [
      "🧩 **Recrutamento**",
      "Ajuste as opções do processo antes de publicar o painel público.",
      HR,
      bullet("Editar **Classes** (lista de opções)"),
      bullet("Editar **Formulário** (perguntas dinâmicas)"),
      bullet("**Aparência** do painel (título, descrição, banner)"),
      GAP,
      "_Dica:_ mantenha perguntas curtas e objetivas.",
    ].join("\n");

  const actions = row(
    new ButtonBuilder().setCustomId(DASH.RECRUIT_EDIT_CLASSES).setLabel("Editar Classes").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(DASH.RECRUIT_EDIT_FORM).setLabel("Editar Formulário").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(DASH.RECRUIT_APPEARANCE).setLabel("Aparência").setStyle(ButtonStyle.Secondary),
  );

  return { content, components: [actions, ...renderBackRow()] } as const;
}

export function renderEventsMenu() {
  const content =
    [
      "📅 **Eventos**",
      "Crie e gerencie eventos do servidor.",
      HR,
      bullet("**Criar Evento** (data/hora, descrição, canal)"),
      bullet("**Editar Evento** (alterar informações)"),
      bullet("**Listar Eventos** (próximos e passados)"),
      GAP,
      "_Futuro:_ templates e publicação automática.",
    ].join("\n");

  const actions = row(
    new ButtonBuilder().setCustomId(DASH.EVENTS_CREATE).setLabel("Criar Evento").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(DASH.EVENTS_EDIT).setLabel("Editar Evento").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(DASH.EVENTS_LIST).setLabel("Listar Eventos").setStyle(ButtonStyle.Secondary),
  );

  return { content, components: [actions, ...renderBackRow()] } as const;
}

export function renderEngageMenu() {
  const content =
    [
      "📣 **Engajamento**",
      "Ferramentas de comunidade.",
      HR,
      bullet("**Votações** (criar, encerrar)"),
      bullet("**Sugestões** (coletar e moderar)"),
      bullet("**Ranking** (participação, pontos)"),
      GAP,
      "_Futuro:_ presets de votação e filtros no ranking.",
    ].join("\n");

  const actions = row(
    new ButtonBuilder().setCustomId(DASH.ENGAGE_VOTES).setLabel("Votações").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(DASH.ENGAGE_SUGGESTIONS).setLabel("Sugestões").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(DASH.ENGAGE_RANKING).setLabel("Ranking").setStyle(ButtonStyle.Secondary),
  );

  return { content, components: [actions, ...renderBackRow()] } as const;
}

export function renderAdminMenu() {
  const content =
    [
      "🛡️ **Administração**",
      "Configuração e moderação.",
      HR,
      bullet("**Cargos** (atribuir/retirar)"),
      bullet("**Anúncios** (mensagens do staff)"),
      bullet("**Inativos** (marcar e notificar)"),
      GAP,
      "_Futuro:_ presets e auditoria simples.",
    ].join("\n");

  const actions = row(
    new ButtonBuilder().setCustomId(DASH.ADMIN_ROLES).setLabel("Cargos").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(DASH.ADMIN_ANNOUNCEMENTS).setLabel("Anúncios").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(DASH.ADMIN_INACTIVE).setLabel("Inativos").setStyle(ButtonStyle.Secondary),
  );

  return { content, components: [actions, ...renderBackRow()] } as const;
}
