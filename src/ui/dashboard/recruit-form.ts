import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { FormConfig } from "../../db/repos/guildConfig.repo";
import { DEFAULT_FORM_CONFIG, FormConfigSchema } from "../../db/repos/guildConfig.repo";

export const FORM_ROUTE = {
  OPEN: "dash:form:open",
  EDIT: "dash:form:edit",
  RESET: "dash:form:reset",
  SAVE: "dash:form:save",
  FIELD_JSON: "json",
} as const;

export function renderFormPanel(current: FormConfig) {
  // CORREÇÃO: As strings no array foram corrigidas para estarem em uma única linha.
  // O caractere de nova linha (\n) foi movido para o início da string.
  // Isso resolve todos os 41 erros de sintaxe.
  const content = [
    "**Formulário de Recrutamento**",
    "\n— Edite as opções de *classe* e as *perguntas* extras (Nick é sempre obrigatório).",
    "\n— Limite: Nick + até **4** perguntas (máx de inputs do modal).",
  ].join("");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(FORM_ROUTE.EDIT).setLabel("Editar JSON").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(FORM_ROUTE.RESET).setLabel("Resetar padrão").setStyle(ButtonStyle.Secondary),
  );

  return { content, components: [row] };
}

export function buildEditModal(current: FormConfig) {
  const json = JSON.stringify(current, null, 2);
  const modal = new ModalBuilder().setCustomId(FORM_ROUTE.SAVE).setTitle("Editar Form (JSON)");
  const ti = new TextInputBuilder()
    .setCustomId(FORM_ROUTE.FIELD_JSON)
    .setLabel("Cole/edite o JSON do formulário")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(json.slice(0, 4000));
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(ti));
  return modal;
}

export function parseFormJSON(input: string): FormConfig {
  const raw = JSON.parse(input);
  return FormConfigSchema.parse(raw);
}

export function defaultJSON(): string {
  return JSON.stringify(DEFAULT_FORM_CONFIG, null, 2);
}
