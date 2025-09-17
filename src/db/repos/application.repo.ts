import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function safeParse<T = any>(s?: string | null, fallback: T = [] as any) {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export default class ApplicationRepo {
  async findLatestByUserGuild(userId: string, guildId: string) {
    return prisma.application.findFirst({
      where: { userId, guildId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    guildId: string;
    userId: string;
    username: string;
    nick: string;
    className: string;
    answers?: string[]; // será serializado
  }) {
    const qAnswers = data.answers ? JSON.stringify(data.answers) : undefined;
    const app = await prisma.application.create({
      data: { guildId: data.guildId, userId: data.userId, username: data.username, nick: data.nick, className: data.className, qAnswers },
    });
    return { ok: true as const, app: { ...app, answers: safeParse<string[]>(app.qAnswers) } };
  }

  async listByStatus(guildId: string, status: 'pending' | 'approved' | 'rejected') {
    const rows = await prisma.application.findMany({
      where: { guildId, status },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ ...r, answers: safeParse<string[]>(r.qAnswers) }));
  }

  async setStatus(id: string, status: 'approved' | 'rejected', reason?: string | null) {
    const app = await prisma.application.update({ where: { id }, data: { status, reason: reason ?? null } });
    return { ...app, answers: safeParse<string[]>(app.qAnswers) };
  }
}
