import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class GuildConfigRepo {
  async getByGuildId(guildId: string) {
    let row = await prisma.recruitSettings.findUnique({ where: { guildId } });
    if (!row) row = await prisma.recruitSettings.create({ data: { guildId } });
    return row;
  }

  async setPanelChannel(guildId: string, channelId: string | null) {
    await prisma.recruitSettings.upsert({
      where: { guildId },
      update: { panelChannelId: channelId },
      create: { guildId, panelChannelId: channelId ?? undefined },
    });
  }

  async setFormsChannel(guildId: string, channelId: string | null) {
    await prisma.recruitSettings.upsert({
      where: { guildId },
      update: { formsChannelId: channelId },
      create: { guildId, formsChannelId: channelId ?? undefined },
    });
  }
}
export default GuildConfigRepo;
