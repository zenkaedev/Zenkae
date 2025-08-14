// src/ui/recruit/form.ts
// Wizard do formulário de candidatura
// Passo 1 (ephemeral): SELECT de Classe + [Continuar/Cancelar]
// Passo 2 (modal): Nick (fixo) + perguntas configuráveis (até 5 text inputs)

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from 'discord.js';
import { z } from 'zod';

/* -------------------- IDs padronizados -------------------- */
export const IDs = {
  classSelect: 'recruit:class:select',
  classNext: 'recruit:class:next',
  classCancel: 'recruit:class:cancel',
} as const;

export const MODAL_ID = 'recruit:form';
export const FIELD = {
  nick: 'nick',
  classe: 'classe',
  q1: 'q1',
  q2: 'q2',
  q3: 'q3',
  q4: 'q4',
  q5: 'q5',
} as const;

/* -------------------- Tipos de configuração -------------------- */
export type SelectOption = { label: string; value: string };

export type FormQuestion =
  | {
      kind: 'short'; // input curto (1 linha)
      key: string; // ex.: "xp"
      label: string; // ex.: "Experiência"
      required?: boolean;
      placeholder?: string;
      maxLength?: number; // padrão 100
    }
  | {
      kind: 'long'; // input longo (parágrafo)
      key: string; // ex.: "disp"
      label: string; // ex.: "Disponibilidade"
      required?: boolean;
      placeholder?: string;
      maxLength?: number; // padrão 400
    };

/* -------------------- Passo 1: Classe (select) -------------------- */
export function buildClassStep(classes: SelectOption[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(IDs.classSelect)
    .setPlaceholder('Selecione sua classe')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(...classes.map((c) => ({ label: c.label, value: c.value })));

  const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const rowActions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(IDs.classNext).setStyle(ButtonStyle.Success).setLabel('Continuar'),
    new ButtonBuilder().setCustomId(IDs.classCancel).setStyle(ButtonStyle.Secondary).setLabel('Cancelar'),
  );

  return {
    content:
      '**Início da candidatura**\n' +
      'Escolha sua **Classe** no menu abaixo e clique **Continuar**.\n' +
      'Você confirmará os demais dados no próximo passo.',
    components: [rowSelect, rowActions],
    allowedMentions: { parse: [] as any[] },
  };
}

/* -------------------- Passo 2: Modal (Nick + perguntas) -------------------- */
export function buildRecruitModal(input: {
  selectedClass: string; // vindo do passo anterior (select)
  questions?: FormQuestion[]; // até 5 perguntas (só texto)
}) {
  const qs = (input.questions ?? []).slice(0, 5);

  const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('Formulário de Candidatura');

  // 1) Nick (fixo/obrigatório)
  const nick = new TextInputBuilder()
    .setCustomId(FIELD.nick)
    .setLabel('Seu Nick no servidor')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: Marcos, Zenkae…');

  // 2) Classe (mostra a escolha; valor oficial é o selectedClass guardado)
  const classe = new TextInputBuilder()
    .setCustomId(FIELD.classe)
    .setLabel('Classe (pré-selecionada)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(input.selectedClass)
    .setPlaceholder('Selecionei no passo anterior');

  const rows: ActionRowBuilder<TextInputBuilder>[] = [
    new ActionRowBuilder<TextInputBuilder>().addComponents(nick),
    new ActionRowBuilder<TextInputBuilder>().addComponents(classe),
  ];

  // 3) Perguntas dinâmicas (até 5)
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (!q) continue;

    const fieldId = indexToFieldId(i); // q1..q5
    const base = new TextInputBuilder()
      .setCustomId(fieldId)
      .setLabel(limit(q.label, 45))
      .setRequired(!!q.required);

    if (q.placeholder) base.setPlaceholder(q.placeholder);

    if (q.kind === 'long') {
      base.setStyle(TextInputStyle.Paragraph).setMaxLength(Math.max(1, q.maxLength ?? 400));
    } else {
      base.setStyle(TextInputStyle.Short).setMaxLength(Math.max(1, q.maxLength ?? 100));
    }

    rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(base));
  }

  modal.addComponents(...rows);
  return modal;
}

/* -------------------- Parse/Validação do submit -------------------- */
const schema = z.object({
  nick: z.string().trim().min(2, 'Nick muito curto').max(32),
  classe: z.string().trim().min(1),
  answers: z.record(z.string(), z.string().trim()).optional().default({}),
});

/**
 * Lê os campos do modal e retorna dados normalizados.
 * - selectedClass prevalece sobre o valor digitado no campo "classe"
 *   (o do modal é apenas visual).
 */
export function parseRecruitModal(ix: ModalSubmitInteraction, selectedClass?: string) {
  const rawNick = safeGet(ix, FIELD.nick);
  const rawClasse = safeGet(ix, FIELD.classe);

  // coleta q1..q5 se existirem
  const answers: Record<string, string> = {};
  for (const id of [FIELD.q1, FIELD.q2, FIELD.q3, FIELD.q4, FIELD.q5]) {
    const val = safeGet(ix, id);
    if (val) answers[id] = val.trim();
  }

  const parsed = schema.parse({
    nick: rawNick,
    classe: (selectedClass ?? rawClasse).trim(),
    answers,
  });

  return parsed as { nick: string; classe: string; answers: Record<string, string> };
}

/* -------------------- helpers -------------------- */
function indexToFieldId(i: number): (typeof FIELD)[keyof typeof FIELD] {
  return [FIELD.q1, FIELD.q2, FIELD.q3, FIELD.q4, FIELD.q5][i]!;
}
function limit(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function safeGet(ix: ModalSubmitInteraction, id: string): string {
  try {
    // d.js lança erro se não existir; aqui tratamos e devolvemos vazio
    return ix.fields.getTextInputValue(id) ?? '';
  } catch {
    return '';
  }
}
