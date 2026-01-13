// src/modules/matchmaking/types.ts

export type PartyRole = string; // Flexível: 'Tank', 'Healer', 'DPS', etc
export type PartyStatus = 'open' | 'full' | 'cancelled';

export interface PartySlots {
    [role: string]: {
        max: number;
        members: string[]; // Discord user IDs
    };
}

export interface PartyData {
    id: string;
    guildId: string;
    channelId: string;
    messageId: string;
    leaderId: string;
    title: string;
    datetime: string;
    description: string;
    slots: PartySlots;
    status: PartyStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreatePartyInput {
    guildId: string;
    channelId: string;
    leaderId: string;
    leaderRole: string; // 'Tank', 'Healer', ou 'DPS'
    title: string;
    datetime: string;
    description: string;
    slotsString: string; // "1, 2, 3" (Tank, Healer, DPS)
}
