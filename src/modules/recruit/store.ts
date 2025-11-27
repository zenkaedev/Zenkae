// src/modules/recruit/store.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Status possível de uma aplicação */
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

/** Estrutura de Classe exibida/gerenciada na UI */
export type Class = {
  id: string;
  name: string;
  emoji?: string | null;
  roleId?: string | null;
  /** Cor HEX padronizada em formato #RRGGBB (ou null) */
  color?: string | null;
};

/* ------------------------------ JSON helpers ------------------------------ */

function toJsonString(v: unknown): string {
  try {
    // padrão para arrays/campos compostos
    return JSON.stringify(v ?? []);
  } catch {
    return '[]';
  }
}

function parseArrayStr<T = string>(s?: string | null, fallback: T[] = []): T[] {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------ Normalizadores ---------------------------- */

/**
 * Normaliza cor para o formato #RRGGBB.
 * Aceita: #RGB, RGB, #RRGGBB, RRGGBB. Qualquer outro formato retorna null.
 */
function normalizeHexColor(input?: unknown): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  const raw = s.startsWith('#') ? s.slice(1) : s;

  // #RGB → #RRGGBB
  const short = /^([a-fA-F\d]{3})$/.exec(raw);
  if (short?.[1]) {
    const chars = short[1];
    const r = chars[0],
      g = chars[1],
      b = chars[2];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  // #RRGGBB
  const full = /^([a-fA-F\d]{6})$/.exec(raw);
  if (full?.[1]) return `#${full[1]}`.toUpperCase();

  return null;
}

/** Garante o shape seguro de uma Class vinda de JSON dinâmico */
function normalizeClass(c: Partial<Class> | any): Class {
  return {
    id: String(c?.id ?? ''),
    name: String(c?.name ?? '')
      .slice(0, 60)
      .trim(),
    emoji: c?.emoji != null ? String(c.emoji).slice(0, 16) : null,
    roleId: c?.roleId != null ? String(c.roleId) : null,
    color: normalizeHexColor(c?.color),
  };
}

/* ------------------------------- RecruitStore ------------------------------ */

export const recruitStore = {
  /* --------------------------- SETTINGS (guild) --------------------------- */

  /** Busca settings; cria com defaults se não existir */
  async getSettings(guildId: string) {
    let s = await prisma.recruitSettings.findUnique({ where: { guildId } });
    if (!s) {
      s = await prisma.recruitSettings.create({
        data: {
          guildId,
          // defaults seguros p/ campos JSON serializados
          questions: toJsonString([]),
          classes: toJsonString([]),
          appearanceTitle: null,
          appearanceDescription: null,
          appearanceImageUrl: null,
          panelChannelId: null,
          formsChannelId: null,
          defaultApprovedRoleId: null,
          dmAcceptedTemplate: '🟢 Sua candidatura foi aprovada! Bem-vindo(a) {user}.',
          dmRejectedTemplate: '🔴 Sua candidatura foi recusada. Motivo: {reason}',
        },
      });
    }

    // Garantir que mudanças de schema recentes tenham valor default
    const needsBackfill =
      s.questions == null ||
      s.classes == null ||
      typeof s.dmAcceptedTemplate !== 'string' ||
      typeof s.dmRejectedTemplate !== 'string';

    if (needsBackfill) {
      s = await prisma.recruitSettings.update({
        where: { guildId },
        data: {
          questions: s.questions ?? toJsonString([]),
          classes: s.classes ?? toJsonString([]),
          dmAcceptedTemplate:
            s.dmAcceptedTemplate ?? '🟢 Sua candidatura foi aprovada! Bem-vindo(a) {user}.',
          dmRejectedTemplate:
            s.dmRejectedTemplate ?? '🔴 Sua candidatura foi recusada. Motivo: {reason}',
        },
      });
    }

    return s;
  },

  /**
   * Atualiza settings. Campos com arrays (questions/classes) são normalizados para string JSON.
   */
  async updateSettings(
    guildId: string,
    data: Partial<{
      panelChannelId: string | null;
      formsChannelId: string | null;
      appearanceTitle: string | null;
      appearanceDescription: string | null;
      appearanceImageUrl: string | null;
      questions: string[]; // UI usa array; persistência usa string JSON
      dmAcceptedTemplate: string;
      dmRejectedTemplate: string;
      classes: Class[]; // UI usa array; persistência usa string JSON
      defaultApprovedRoleId: string | null;
    }>,
  ) {
    const normalized: any = { ...data };

    if (Array.isArray(data.questions)) {
      // Limite de 5 no planejamento; use 4 se quiser manter original, aqui deixo 5.
      normalized.questions = toJsonString(data.questions.slice(0, 5));
    }

    if (Array.isArray(data.classes)) {
      // saneamento básico: manter apenas chaves conhecidas + cor normalizada
      const clean = data.classes.map((c) => normalizeClass(c));
      normalized.classes = toJsonString(clean);
    }

    return prisma.recruitSettings.upsert({
      where: { guildId },
      update: normalized,
      create: { guildId, ...normalized },
    });
  },

  /* ----------------------------- CLASSES JSON ---------------------------- */

  parseClasses(raw?: string | null): Class[] {
    const arr = parseArrayStr<any>(raw, []);
    return arr.map((c) => normalizeClass(c));
  },

  stringifyClasses(classes: Class[]): string {
    // Garante que toda classe persistida está normalizada (inclusive cor)
    return toJsonString(classes.map((c) => normalizeClass(c)));
  },

  /* ------------------------------ QUESTIONS ------------------------------ */

  parseQuestions(raw?: string | null): string[] {
    return parseArrayStr<string>(raw, []);
  },

  /* -------------------------------- PANEL -------------------------------- */

  async getPanel(guildId: string) {
    return prisma.recruitPanel.findUnique({ where: { guildId } });
  },

  async setPanel(guildId: string, ref: { channelId: string; messageId: string }) {
    return prisma.recruitPanel.upsert({
      where: { guildId },
      update: { channelId: ref.channelId, messageId: ref.messageId },
      create: { guildId, ...ref },
    });
  },

  /* ------------------------------ APPLICATION ---------------------------- */

  async create(app: {
    guildId: string;
    userId: string;
    username: string;
    nick: string;
    /** Nome da classe selecionada no momento do envio (mantido por compatibilidade) */
    className: string;
    /** Opcional novo: id da classe da UI, se disponível */
    classId?: string | null;
    attachmentUrl?: string | null;
  }) {
    return prisma.application.create({
      data: {
        guildId: app.guildId,
        userId: app.userId,
        username: app.username,
        nick: app.nick,
        className: app.className,
        classId: app.classId ?? null,
        attachmentUrl: app.attachmentUrl ?? null,
        status: 'pending',
        qAnswers: toJsonString([]),
      },
    });
  },

  async setAnswers(appId: string, answers: string[]) {
    return prisma.application.update({
      where: { id: appId },
      data: { qAnswers: toJsonString(answers) },
    });
  },

  async setAttachment(appId: string, url: string) {
    return prisma.application.update({
      where: { id: appId },
      data: { attachmentUrl: url },
    });
  },

  async findByUser(guildId: string, userId: string) {
    return prisma.application.findFirst({
      where: { guildId, userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    return prisma.application.findUnique({ where: { id } });
  },

  /** Atualiza status + metadados de moderação (compatível com UI atual) */
  async updateStatus(
    id: string,
    status: ApplicationStatus,
    reason: string | null = null,
    moderatedById?: string,
    moderatedByDisplay?: string,
  ) {
    const data: any = {
      status,
      reason: reason ?? null,
      moderatedAt: new Date(),
    };
    if (moderatedById) data.moderatedById = moderatedById;
    if (moderatedByDisplay) data.moderatedByDisplay = moderatedByDisplay;

    return prisma.application.update({ where: { id }, data });
  },

  async setCardRef(id: string, ref: { channelId: string; messageId: string }) {
    return prisma.application.update({
      where: { id },
      data: { channelId: ref.channelId, messageId: ref.messageId },
    });
  },

  async listByStatus(guildId: string, status: ApplicationStatus, take = 10) {
    return prisma.application.findMany({
      where: { guildId, status },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  /* ------------------------------ ANSWERS I/O ----------------------------- */

  /** Parse de respostas para leitura segura na UI/card */
  parseAnswers(raw?: string | null) {
    return parseArrayStr<string>(raw, []);
  },
};
