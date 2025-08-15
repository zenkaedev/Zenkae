import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

function toJsonString(v: unknown): string {
  try { return JSON.stringify(v ?? []); } catch { return '[]'; }
}
function parseArrayStr<T = string>(s?: string | null): T[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? (v as T[]) : []; } catch { return []; }
}

export const recruitStore = {
  async getSettings(guildId: string) {
    let s = await prisma.recruitSettings.findUnique({ where: { guildId } });
    if (!s) s = await prisma.recruitSettings.create({ data: { guildId } });
    return s;
  },

  async updateSettings(
    guildId: string,
    data: Partial<{
      panelChannelId: string | null;
      formsChannelId: string | null;
      appearanceTitle: string | null;
      appearanceDescription: string | null;
      appearanceImageUrl: string | null;
      questions: string[];
      dmAcceptedTemplate: string;
      dmRejectedTemplate: string;
    }>,
  ) {
    const normalized: any = { ...data };
    if (data.questions) normalized.questions = toJsonString(data.questions.slice(0, 4));
    return prisma.recruitSettings.upsert({
      where: { guildId },
      update: normalized,
      create: { guildId, ...normalized },
    });
  },

  // CORREÇÃO: Adicionando a função getPanel que faltava
  async getPanel(guildId: string) {
    return prisma.recruitPanel.findUnique({ where: { guildId } });
  },

  async setPanel(guildId: string, ref: { channelId: string; messageId: string }) {
    // Usamos upsert para criar ou atualizar o painel existente
    return prisma.recruitPanel.upsert({
        where: { guildId },
        update: { channelId: ref.channelId, messageId: ref.messageId },
        create: { guildId, ...ref },
    });
  },

  async create(app: {
    guildId: string;
    userId: string;
    username: string;
    nick: string;
    className: string;
  }) {
    return prisma.application.create({ data: app });
  },

  async setAnswers(appId: string, answers: string[]) {
    return prisma.application.update({
      where: { id: appId },
      data: { qAnswers: toJsonString(answers) },
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

    return prisma.application.update({
      where: { id },
      data,
    });
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

  // helpers para leitura já parseada onde você quiser usar
  parseQuestions(raw?: string | null) {
    return parseArrayStr<string>(raw);
  },
  parseAnswers(raw?: string | null) {
    return parseArrayStr<string>(raw);
  },
};
