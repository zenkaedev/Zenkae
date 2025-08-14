// src/ui/recruit/form.ts
// Wizard do formulário de candidatura:
// Passo 1 (ephemeral): SELECT de Classe + [Continuar/Cancelar]
// Passo 2 (modal): Nick (fixo) + perguntas configuráveis (até 5 text inputs)
//
// Como usar no router:
// 1) No clique "recruit:apply" → reply ephemeral com buildClassStep(config.classes)
// 2) Ao clicar "recruit:class:next":
//    - verifique se o user selecionou uma classe (ex.: guardando em memória por (guildId+userId))
//    - chame buildRecruitModal({ selectedClass, questions: config.formQuestions })
// 3) Ao receber o submit (customId === MODAL_ID):
//    - use parseRecruitModal(ix, selectedClass) para validar/normalizar os dados
//
// Dica: mantenha a escolha de classe em um Map com TTL no service (ex.: services/recruit.service.ts).

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

// -------------------- IDs padronizados --------------------
export const IDs = {
  classSelect: 'recruit:class:select',
  classNext:   'recruit:class:next',
  classCancel: 'recruit:class:cancel',
};

export const MODAL_ID = 'recruit:form';
export const FIELD = {
  nick:   'nick',
  classe: 'classe',
  q1: 'q1',
  q2: 'q2',
  q3: 'q3',
  q4: 'q4',
  q5: 'q5',
} as const;

// -------------------- Tipos de configuração --------------------
export type SelectOption = { label: string; value: string };

export type FormQuestion =
  | {
      kind: 'short';               // input curto (1 linha)
      key: string;                 // ex.: "xp"
      label: string;               // ex.: "Experiência"
      required?: boolean;
      placeholder?: string;
      maxLength?: number;          // padrão 100
    }
  | {
      kind: 'long';                // input longo (parágrafo)
      key: string;                 // ex.: "disp"
      label: string;               // ex.: "Disponibilidade"
      required?: boolean;
      placeholder?: string;
      maxLength?: number;          // padrão 400
    };

// -------------------- Passo 1: Classe (select) --------------------
export function buildClassStep(classes: SelectOption[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(IDs.classSelect)
    .setPlaceholder('Selecione sua classe')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(...classes.map((c) => ({ label: c.label, value: c.value })));

  const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const rowActions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(IDs.classNext)
      .setStyle(ButtonStyle.Success)
      .setLabel('Continuar'),
    new ButtonBuilder()
      .setCustomId(IDs.classCancel)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Cancelar'),
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

// -------------------- Passo 2: Modal (Nick + perguntas) --------------------
export function buildRecruitModal(input: {
  selectedClass: string;         // vindo do passo anterior (select)
  questions?: FormQuestion[];    // até 5 perguntas (só texto)
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

  // 2) Classe (mostra a escolha; o valor oficial é o selectedClass guardado)
  const classe = new TextInputBuilder()
    .setCustomId(FIELD.classe)
    .setLabel('Classe (pré-selecionada)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(input.selectedClass) // o usuário pode alterar, mas no parse a gente confere com o selectedClass
    .setPlaceholder('Selecionei no passo anterior');

  const rows: ActionRowBuilder<TextInputBuilder>[] = [
    new ActionRowBuilder<TextInputBuilder>().addComponents(nick),
    new ActionRowBuilder<TextInputBuilder>().addComponents(classe),
  ];

  // 3) Perguntas dinâmicas
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const id = indexToFieldId(i); // mapeia p/ q1..q5
    const base = new TextInputBuilder()
      .setCustomId(id)
      .setLabel(limit(q.label, 45))
      .setRequired(!!q.required)
      .setPlaceholder(q.placeholder ?? '');

    if (q.kind === 'short') {
      base.setStyle(TextInputStyle.Short).setMaxLength(q.maxLength ?? 100);
    } else {
      base.setStyle(TextInputStyle.Paragraph).setMaxLength(q.maxLength ?? 400);
    }

    rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(base));
  }

  modal.addComponents(...rows.slice(0, 5)); // Discord permite no máx. 5 inputs no modal
  return { modal };
}

// -------------------- Parse/Validação do submit --------------------
const schema = z.object({
  nick: z.string().trim().min(2, 'Nick muito curto').max(32),
  classe: z.string().trim().min(1),
  answers: z.record(z.string(), z.string().trim().min(0)).optional().default({}),
});

/**
 * Lê os campos do modal e retorna dados normalizados.
 * - selectedClass prevalece sobre o valor digitado no campo "classe" (o do modal é só para confirmação visual).
 */
export function parseRecruitModal(ix: ModalSubmitInteraction, selectedClass?: string) {
  const rawNick = ix.fields.getTextInputValue(FIELD.nick) ?? '';
  const rawClasse = ix.fields.getTextInputValue(FIELD.classe) ?? '';

  // coleta q1..q5 se existirem
  const answers: Record<string, string> = {};
  for (const id of [FIELD.q1, FIELD.q2, FIELD.q3, FIELD.q4, FIELD.q5]) {
    const val = ix.fields.fields.get(id)?.value;
    if (typeof val === 'string') answers[id] = val.trim();
  }

  const parsed = schema.parse({
    nick: rawNick,
    classe: selectedClass?.trim() || rawClasse.trim(),
    answers,
  });

  return parsed; // { nick, classe, answers: { q1?:string, ... } }
}

// -------------------- helpers --------------------
function indexToFieldId(i: number): (typeof FIELD)[keyof typeof FIELD] {
  return [FIELD.q1, FIELD.q2, FIELD.q3, FIELD.q4, FIELD.q5][i]!;
}
function limit(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
