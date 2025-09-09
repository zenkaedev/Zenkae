// src/modules/poll/store.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export type PollInput = {
  guildId: string;
  channelId: string;
  question: string;
  options: string[];
  multi?: boolean;
  endsAt?: Date | null;
  createdById: string;
};

export const pollStore = {
  async create(data: PollInput) {
    return prisma.poll.create({
      data: {
        guildId: data.guildId,
        channelId: data.channelId,
        question: data.question,
        optionsJson: JSON.stringify(data.options),
        multi: !!data.multi,
        endsAt: data.endsAt ?? null,
        createdById: data.createdById,
      },
    });
  },

  async setMessageRef(pollId: string, channelId: string, messageId: string) {
    return prisma.poll.update({ where: { id: pollId }, data: { channelId, messageId } });
  },

  async getById(id: string) {
    return prisma.poll.findUnique({ where: { id } });
  },

  async addOrToggleVote(pollId: string, userId: string, optionIdx: number, multi: boolean) {
    if (multi) {
      const existing = await prisma.pollVote
        .findUnique({
          where: { pollId_userId_optionIdx: { pollId, userId, optionIdx } },
        })
        .catch(() => null as any);
      if (existing) {
        await prisma.pollVote.delete({ where: { id: existing.id } });
      } else {
        await prisma.pollVote.create({ data: { pollId, userId, optionIdx } });
      }
      return;
    }
    await prisma.$transaction([
      prisma.pollVote.deleteMany({ where: { pollId, userId } }),
      prisma.pollVote.create({ data: { pollId, userId, optionIdx } }),
    ]);
  },

  async countVotes(pollId: string) {
    const rows = await prisma.pollVote.groupBy({
      by: ['optionIdx'],
      where: { pollId },
      _count: { optionIdx: true },
    });
    const counts: Record<number, number> = {};
    for (const r of rows) counts[r.optionIdx] = r._count.optionIdx;
    return counts;
  },

  // ✅ novo
  async updateEndsAt(pollId: string, endsAt: Date) {
    return prisma.poll.update({ where: { id: pollId }, data: { endsAt } });
  },
};
