// src/modules/matchmaking/store.ts

import { Context } from '../../infra/context.js';
import type { CreatePartyInput, PartyData, PartySlots } from './types.js';
import { parseSlots } from './visual.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

export const matchmakingStore = {
    /**
     * Criar nova party
     */
    async create(input: CreatePartyInput, messageId: string): Promise<PartyData> {
        const slots = parseSlots(input.slotsString);

        // Adicionar líder automaticamente na primeira vaga de DPS (ou primeira role disponível)
        const firstRole = Object.keys(slots)[0];
        if (firstRole && slots[firstRole].max > 0) {
            slots[firstRole].members.push(input.leaderId);
        }

        const party = await prisma.party.create({
            data: {
                guildId: input.guildId,
                channelId: input.channelId,
                messageId,
                leaderId: input.leaderId,
                title: input.title,
                datetime: input.datetime,
                description: input.description,
                slotsJson: JSON.stringify(slots),
                status: 'open',
            },
        });

        // Criar membro para o líder
        if (firstRole) {
            await prisma.partyMember.create({
                data: {
                    partyId: party.id,
                    userId: input.leaderId,
                    role: firstRole,
                },
            });
        }

        return this.parseParty(party);
    },

    /**
     * Buscar party por ID
     */
    async getById(partyId: string): Promise<PartyData | null> {
        const party = await prisma.party.findUnique({
            where: { id: partyId },
            include: { members: true },
        });

        return party ? this.parseParty(party) : null;
    },

    /**
     * Buscar party por messageId
     */
    async getByMessage(messageId: string): Promise<PartyData | null> {
        const party = await prisma.party.findUnique({
            where: { messageId },
            include: { members: true },
        });

        return party ? this.parseParty(party) : null;
    },

    /**
     * Adicionar membro a uma role
     */
    async addMember(partyId: string, userId: string, role: string): Promise<boolean> {
        const party = await this.getById(partyId);
        if (!party) return false;

        const slots = party.slots;
        const roleData = slots[role];

        if (!roleData) return false; // Role não existe
        if (roleData.members.length >= roleData.max) return false; // Vaga cheia

        // Verificar se usuário já está na party
        const alreadyIn = Object.values(slots).some(r => r.members.includes(userId));
        if (alreadyIn) return false;

        // Adicionar
        roleData.members.push(userId);

        await prisma.party.update({
            where: { id: partyId },
            data: { slotsJson: JSON.stringify(slots) },
        });

        await prisma.partyMember.create({
            data: {
                partyId,
                userId,
                role,
            },
        });

        // Atualizar status se ficou full
        const isFull = Object.values(slots).every(r => r.members.length >= r.max);
        if (isFull) {
            await prisma.party.update({
                where: { id: partyId },
                data: { status: 'full' },
            });
        }

        return true;
    },

    /**
     * Remover membro
     */
    async removeMember(partyId: string, userId: string): Promise<boolean> {
        const party = await this.getById(partyId);
        if (!party) return false;

        const slots = party.slots;
        let found = false;

        for (const roleData of Object.values(slots)) {
            const idx = roleData.members.indexOf(userId);
            if (idx !== -1) {
                roleData.members.splice(idx, 1);
                found = true;
                break;
            }
        }

        if (!found) return false;

        await prisma.party.update({
            where: { id: partyId },
            data: {
                slotsJson: JSON.stringify(slots),
                status: 'open', // Volta para open se estava full
            },
        });

        await prisma.partyMember.deleteMany({
            where: { partyId, userId },
        });

        return true;
    },

    /**
     * Cancelar party
     */
    async delete(partyId: string): Promise<void> {
        await prisma.party.update({
            where: { id: partyId },
            data: { status: 'cancelled' },
        });
    },

    /**
     * Atualizar messageId
     */
    async updateMessageId(partyId: string, messageId: string): Promise<void> {
        await prisma.party.update({
            where: { id: partyId },
            data: { messageId },
        });
    },

    /**
     * Salvar totem settings
     */
    async saveTotem(guildId: string, channelId: string, messageId: string): Promise<void> {
        await prisma.matchmakingSettings.upsert({
            where: { guildId },
            update: { totemChannelId: channelId, totemMessageId: messageId },
            create: { guildId, totemChannelId: channelId, totemMessageId: messageId },
        });
    },

    /**
     * Helper: Parse party do DB
     */
    parseParty(raw: any): PartyData {
        return {
            id: raw.id,
            guildId: raw.guildId,
            channelId: raw.channelId,
            messageId: raw.messageId,
            leaderId: raw.leaderId,
            title: raw.title,
            datetime: raw.datetime,
            description: raw.description,
            slots: JSON.parse(raw.slotsJson),
            status: raw.status,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    },
};
