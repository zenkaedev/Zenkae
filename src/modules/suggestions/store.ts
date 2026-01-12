// src/modules/suggestions/store.ts
import { prisma } from '../../prisma/client.js';

export type VoteType = 'agree' | 'disagree';

export interface SuggestionData {
    guildId: string;
    userId: string;
    userDisplay: string;
    title: string;
    description: string;
    channelId: string;
    messageId: string;
}

export const suggestionStore = {
    /* ----------------------------- SETTINGS ----------------------------- */

    async getSettings(guildId: string) {
        let settings = await prisma.suggestionSettings.findUnique({
            where: { guildId }
        });

        if (!settings) {
            settings = await prisma.suggestionSettings.create({
                data: { guildId }
            });
        }

        return settings;
    },

    async updateSettings(
        guildId: string,
        data: Partial<{
            panelChannelId: string | null;
            panelMessageId: string | null;
            suggestionsChannelId: string | null;
        }>
    ) {
        return prisma.suggestionSettings.upsert({
            where: { guildId },
            update: data,
            create: { guildId, ...data }
        });
    },

    /* ----------------------------- SUGGESTIONS ----------------------------- */

    async create(data: SuggestionData) {
        return prisma.suggestion.create({
            data: {
                guildId: data.guildId,
                userId: data.userId,
                userDisplay: data.userDisplay,
                title: data.title,
                description: data.description,
                channelId: data.channelId,
                messageId: data.messageId,
            }
        });
    },

    async get(id: string) {
        return prisma.suggestion.findUnique({
            where: { id },
            include: { votes: true }
        });
    },

    async getByMessageId(messageId: string) {
        return prisma.suggestion.findFirst({
            where: { messageId },
            include: { votes: true }
        });
    },

    async update(id: string, data: Partial<{ threadId: string; messageId: string }>) {
        return prisma.suggestion.update({
            where: { id },
            data
        });
    },

    async listRecent(guildId: string, limit = 10) {
        return prisma.suggestion.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { votes: true }
        });
    },

    /* ----------------------------- VOTING ----------------------------- */

    // Fix #3: Vote com transaction para evitar race condition
    async vote(suggestionId: string, userId: string, voteType: VoteType): Promise<{ agree: number; disagree: number }> {
        return prisma.$transaction(async (tx: typeof prisma) => {
            // Check existing vote
            const existing = await tx.suggestionVote.findUnique({
                where: {
                    suggestionId_userId: { suggestionId, userId }
                }
            });

            if (existing) {
                if (existing.voteType === voteType) {
                    // Remove vote (toggle off)
                    await tx.suggestionVote.delete({
                        where: { id: existing.id }
                    });
                } else {
                    // Change vote
                    await tx.suggestionVote.update({
                        where: { id: existing.id },
                        data: { voteType }
                    });
                }
            } else {
                // Add new vote
                await tx.suggestionVote.create({
                    data: { suggestionId, userId, voteType }
                });
            }

            // Return updated counts atomically in same transaction
            const votes = await tx.suggestionVote.groupBy({
                by: ['voteType'],
                where: { suggestionId },
                _count: true
            });

            const counts = { agree: 0, disagree: 0 };
            for (const v of votes) {
                if (v.voteType === 'agree') counts.agree = v._count;
                if (v.voteType === 'disagree') counts.disagree = v._count;
            }

            return counts;
        });
    },

    async getVoteCounts(suggestionId: string): Promise<{ agree: number; disagree: number }> {
        const votes = await prisma.suggestionVote.groupBy({
            by: ['voteType'],
            where: { suggestionId },
            _count: true
        });

        const counts = { agree: 0, disagree: 0 };

        for (const v of votes) {
            if (v.voteType === 'agree') counts.agree = v._count;
            if (v.voteType === 'disagree') counts.disagree = v._count;
        }

        return counts;
    },

    async getUserVote(suggestionId: string, userId: string): Promise<VoteType | null> {
        const vote = await prisma.suggestionVote.findUnique({
            where: {
                suggestionId_userId: { suggestionId, userId }
            }
        });

        return vote ? (vote.voteType as VoteType) : null;
    }
};
