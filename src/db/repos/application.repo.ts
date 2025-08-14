// src/db/repos/application.repo.ts
// Status válidos: 'PENDING' | 'APPROVED' | 'REJECTED'
import type { PrismaClient } from '@prisma/client';

export type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const APPLICATION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export interface CreateApplicationInput {
  userId: string;
  guildId: string;
  answers: unknown; // objeto com { class, nick, ... } ou string JSON
}

export function createApplicationRepo(prisma: PrismaClient) {
  function safeParse(s: string) {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  async function findByUserAndGuild(userId: string, guildId: string) {
    const app = await prisma.application.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
    return app ? { ...app, answers: safeParse(app.answers) } : null;
  }

  async function create(input: CreateApplicationInput) {
    try {
      // 1) Verifica duplicado antes (regra: 1 candidatura por user por guild)
      const existing = await prisma.application.findUnique({
        where: {
          userId_guildId: {
            userId: input.userId,
            guildId: input.guildId,
          },
        },
      });
      if (existing) {
        // retorna sem estourar a app
        return { ok: false as const, reason: 'DUP' as const };
      }

      // 2) Normaliza answers para string
      const answersJson =
        typeof input.answers === 'string'
          ? input.answers
          : JSON.stringify(input.answers ?? {});

      // 3) Cria pendente
      const app = await prisma.application.create({
        data: {
          userId: input.userId,
          guildId: input.guildId,
          answers: answersJson,
          status: APPLICATION_STATUS.PENDING,
        },
      });

      return { ok: true as const, app: { ...app, answers: safeParse(app.answers) } };
    } catch (err: any) {
      // Backup: se bater race condition, o Prisma lança P2002
      if (err?.code === 'P2002') return { ok: false as const, reason: 'DUP' as const };
      throw err;
    }
  }

  async function listByGuildAndStatus(
    guildId: string,
    status: AppStatus = APPLICATION_STATUS.PENDING,
  ) {
    const rows = await prisma.application.findMany({
      where: { guildId, status },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ ...r, answers: safeParse(r.answers) }));
  }

  async function decide(appId: string, d: { kind: 'APPROVE' | 'REJECT'; moderatorId: string; reason?: string }) {
    const nextStatus: AppStatus =
      d.kind === 'APPROVE' ? APPLICATION_STATUS.APPROVED : APPLICATION_STATUS.REJECTED;

    return prisma.application.update({
      where: { id: appId },
      data: {
        status: nextStatus,
        decidedAt: new Date(),
        moderatorId: d.moderatorId,
        reason: d.reason,
      },
    });
  }

  async function setMessageId(appId: string, messageId: string) {
    return prisma.application.update({ where: { id: appId }, data: { messageId } });
  }

  return { findByUserAndGuild, create, listByGuildAndStatus, decide, setMessageId };
}

export type ApplicationRepo = ReturnType<typeof createApplicationRepo>;
