import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";

export type DashboardView = "home" | "recruit" | "approvals";
export type DashboardState = { view: DashboardView; page?: number };

function buildContent(state: DashboardState) {
  const title = "**Zenkae — Painel**";
  const subtitle =
    state.view === "home"
      ? "Escolha uma área para gerenciar."
      : state.view === "recruit"
      ? "Recrutamento público (member/recruit + classe)."
      : "Aprovações (editar mensagem, DM de resultado, nickname e roles).";

  // ✅ usando template string (multilinha sem erro de aspas)
  return `${title}
────────────────────────────────
${subtitle}

Use o seletor abaixo para navegar.`;
}

export function renderDashboard(state: DashboardState = { view: "home" }) {
  const nav = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("dash:nav")
      .setPlaceholder("Navegar…")
      .addOptions(
        { label: "Início", value: "home" },
        { label: "Recrutamento", value: "recruit" },
        { label: "Aprovações", value: "approvals" },
      ),
  );

  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("dash:refresh")
      .setLabel("Atualizar Painel")
      .setStyle(ButtonStyle.Primary),
  );

  return { content: buildContent(state), components: [nav, actions] } as const;
}
