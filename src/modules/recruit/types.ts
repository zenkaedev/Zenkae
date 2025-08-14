// src/modules/recruit/types.ts
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface Application {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  nick: string;
  className: string;
  status: ApplicationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface RecruitPanelRef {
  channelId: string;
  messageId: string;
}

export type FilterKind = 'all' | 'pending' | 'approved' | 'rejected';
