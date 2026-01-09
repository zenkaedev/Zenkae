export type RsvpChoice = 'yes' | 'maybe' | 'no';
export type EventStatus = 'scheduled' | 'cancelled' | 'completed';

export interface EventDTO {
  id: string;
  guildId: string;
  title: string;
  description?: string | null;
  startsAt: number;
  status: EventStatus;
  channelId: string;
  messageId: string;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string | null;
  voiceChannelId?: string | null;
  zkReward: number;
  announcementChannelId?: string | null;
  recurrence?: string | null;
}

export interface EventWithCounts extends EventDTO {
  yes: number;
  maybe: number;
  no: number;
}
