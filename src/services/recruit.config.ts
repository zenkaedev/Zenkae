// src/services/recruit.config.ts
// Lê a config de formulário do GuildConfig (classes + perguntas),
// aceita SQLite (string JSON) e Postgres (Json nativo), e aplica defaults.

import type { AppCtx } from '../core/ctx';

export type ClassOption = { label: string; value: string };

export type FormQuestion =
  | { kind: 'short'; key: string; label: string; required?: boolean; maxLength?: number }
  | { kind: 'long';  key: string; label: string; required?: boolean; maxLength?: number };

export interface FormConfig {
  classOptions: ClassOption[];
  questions: FormQuestion[];
}

// Defaults bonitinhos (não te deixam na mão se a guild não configurou ainda)
const DEFAULT_CLASSES: ClassOption[] = [
  { label: 'Guerreiro', value: 'guerreiro' },
  { label: 'Mago',      value: 'mago' },
  { label: 'Arqueiro',  value: 'arqueiro' },
];

const DEFAULT_QUESTIONS: FormQuestion[] = [
  { kind: 'short', key: 'xp',     label: 'Experiência (resumo)', required: true, maxLength: 80 },
  { kind: 'long',  key: 'motivo', label: 'Por que quer entrar?', required: true, maxLength: 300 },
];

// Tenta parsear quando vier string (SQLite). Se já for objeto/array (Postgres), só retorna.
function safeParseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (Array.isArray(val) || typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return fallback;
}

/**
 * Carrega a config de formulário da guild.
 * - Se não existir, retorna defaults
 * - Se existir mas estiver vazia, também aplica defaults
 */
export async function loadFormConfig(ctx: AppCtx, guildId: string): Promise<FormConfig> {
  const row = await ctx.repos.guildConfig.getByGuildId(guildId);
  const classes = safeParseJson<ClassOption[]>(row?.classOptions, []);
  const questions = safeParseJson<FormQuestion[]>(row?.formQuestions, []);

  return {
    classOptions: classes.length ? classes : DEFAULT_CLASSES,
    questions:    questions.length ? questions : DEFAULT_QUESTIONS,
  };
}

/**
 * Normaliza um objeto vindo de UI antes de salvar (garante shape mínimo).
 * Útil quando você implementar a tela de Setup.
 */
export function normalizeFormConfig(input: Partial<FormConfig>): FormConfig {
  const classes = Array.isArray(input.classOptions) ? input.classOptions : [];
  const questions = Array.isArray(input.questions) ? input.questions : [];

  const normClasses = classes
    .filter((c): c is ClassOption => !!c && typeof c.label === 'string' && typeof c.value === 'string')
    .map((c) => ({ label: c.label.trim(), value: c.value.trim() }))
    .filter((c) => c.label && c.value);

  const normQuestions = questions
    .filter(Boolean)
    .map((q) => {
      const kind = q.kind === 'long' ? 'long' : 'short';
      const key = String(q.key ?? '').trim();
      const label = String(q.label ?? '').trim();
      const required = !!q.required;
      const maxLength =
        typeof q.maxLength === 'number' && q.maxLength > 0 ? Math.min(q.maxLength, kind === 'short' ? 100 : 1000) : undefined;

      return { kind, key, label, required, maxLength } as FormQuestion;
    })
    .filter((q) => q.key && q.label);

  return {
    classOptions: normClasses.length ? normClasses : DEFAULT_CLASSES,
    questions:    normQuestions.length ? normQuestions : DEFAULT_QUESTIONS,
  };
}
