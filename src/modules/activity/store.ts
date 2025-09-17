import { prisma } from '../../prisma/client.js';

export const activityStore = {
  async upsertCheck(guildId: string, userId: string) {
    await prisma.memberActivity.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { lastCheckAt: new Date() },
      create: { guildId, userId, lastCheckAt: new Date() },
    });
  },

  async countSince(guildId: string, since: Date) {
    return prisma.memberActivity.count({ where: { guildId, lastCheckAt: { gte: since } } });
  },

  async setPanel(guildId: string, ref: { channelId: string; messageId: string; weekStart: Date }) {
    await prisma.activityPanel.upsert({
      where: { guildId },
      update: { channelId: ref.channelId, messageId: ref.messageId, weekStart: ref.weekStart },
      create: { guildId, ...ref },
    });
  },

  async getPanel(guildId: string) {
    return prisma.activityPanel.findUnique({ where: { guildId } });
  },
};
