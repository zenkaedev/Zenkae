import { prisma } from '../../prisma/client.js';
import type { EventDTO, RsvpChoice, EventWithCounts, EventStatus } from './types.js';

function toDTO(e: any): EventDTO {
  return {
    id: e.id,
    guildId: e.guildId,
    title: e.title,
    description: e.description,
    startsAt: new Date(e.startsAt).getTime(),
    status: e.status as EventStatus,
    channelId: e.channelId,
    messageId: e.messageId,
    createdAt: new Date(e.createdAt).getTime(),
    updatedAt: new Date(e.updatedAt).getTime(),
    imageUrl: e.imageUrl,
    voiceChannelId: e.voiceChannelId,
    zkReward: e.zkReward,
    announcementChannelId: e.announcementChannelId,
    recurrence: e.recurrence,
    dmMessage: e.dmMessage,
  };
}

export const eventsStore = {
  async create(opts: {
    guildId: string;
    title: string;
    description?: string;
    startsAt: Date;
    channelId: string;
    messageId: string;
    imageUrl?: string;
    voiceChannelId?: string;
    zkReward?: number;
    recurrence?: string;
    dmMessage?: string;
    announcementChannelId?: string;
  }): Promise<EventDTO> {
    const r = await prisma.event.create({
      data: {
        guildId: opts.guildId,
        title: opts.title,
        description: opts.description ?? null,
        startsAt: opts.startsAt,
        channelId: opts.channelId,
        messageId: opts.messageId,
        imageUrl: opts.imageUrl ?? null,
        voiceChannelId: opts.voiceChannelId ?? null,
        zkReward: opts.zkReward ?? 0,
        recurrence: opts.recurrence ?? null,
        dmMessage: opts.dmMessage ?? null,
        announcementChannelId: opts.announcementChannelId ?? null,
      },
    });
    return toDTO(r);
  },

  async listUpcoming(guildId: string, limit = 10): Promise<EventDTO[]> {
    const now = new Date();
    const rows = await prisma.event.findMany({
      where: {
        guildId,
        status: 'scheduled',
        startsAt: { gte: new Date(now.getTime() - 15 * 60_000) },
      },
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
    return rows.map(toDTO);
  },

  async listScheduledInNext(hours: number): Promise<EventDTO[]> {
    const now = new Date();
    const until = new Date(now.getTime() + hours * 60 * 60_000);
    const rows = await prisma.event.findMany({
      where: { status: 'scheduled', startsAt: { gte: now, lte: until } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toDTO);
  },

  async stats(eventId: string): Promise<{ yes: number; maybe: number; no: number }> {
    const [yes, maybe, no] = await Promise.all([
      prisma.eventRsvp.count({ where: { eventId, choice: 'yes' } }),
      prisma.eventRsvp.count({ where: { eventId, choice: 'maybe' } }),
      prisma.eventRsvp.count({ where: { eventId, choice: 'no' } }),
    ]);
    return { yes, maybe, no };
  },

  async listUpcomingWithCounts(guildId: string, limit = 10): Promise<EventWithCounts[]> {
    const list = await this.listUpcoming(guildId, limit);
    const res: EventWithCounts[] = [];
    for (const e of list) {
      const s = await this.stats(e.id);
      res.push({ ...e, ...s });
    }
    return res;
  },

  async setStatus(eventId: string, status: EventStatus) {
    await prisma.event.update({ where: { id: eventId }, data: { status } });
  },

  async rsvp(eventId: string, guildId: string, userId: string, choice: RsvpChoice) {
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { choice },
      create: { eventId, guildId, userId, choice },
    });
  },

  async listConfirmedUsers(eventId: string) {
    return prisma.eventRsvp.findMany({ where: { eventId, choice: 'yes' } });
  },

  async getById(eventId: string): Promise<EventDTO | null> {
    const r = await prisma.event.findUnique({ where: { id: eventId } });
    return r ? toDTO(r) : null;
  },

  async hasReminder(eventId: string, kind: '24h' | '1h' | '15m') {
    const r = await prisma.eventReminder.findUnique({ where: { eventId_kind: { eventId, kind } } });
    return !!r;
  },

  async markReminder(eventId: string, kind: '24h' | '1h' | '15m') {
    await prisma.eventReminder.create({ data: { eventId, kind } });
  },

  async setMessageId(eventId: string, messageId: string, channelId: string) {
    await prisma.event.update({
      where: { id: eventId },
      data: { messageId, channelId },
    });
  },

  async update(eventId: string, data: Partial<{ messageId: string; channelId: string; status: EventStatus }>) {
    await prisma.event.update({
      where: { id: eventId },
      data,
    });
  },

  async delete(eventId: string) {
    await prisma.event.delete({ where: { id: eventId } });
  },
};
