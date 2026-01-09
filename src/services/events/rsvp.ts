// src/services/events/rsvp.ts
import { Context } from '../../infra/context.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * RSVP Management for Events
 */
export const eventRSVP = {
    /**
     * Record user's RSVP response
     */
    async recordRSVP(eventId: string, userId: string, response: 'YES' | 'NO'): Promise<void> {
        await prisma.zKEventRSVP.upsert({
            where: { eventId_userId: { eventId, userId } },
            create: { eventId, userId, response },
            update: { response }
        });
    },

    /**
     * Get all RSVPs for an event
     */
    async getRSVPList(eventId: string, response?: 'YES' | 'NO') {
        return prisma.zKEventRSVP.findMany({
            where: {
                eventId,
                ...(response ? { response } : {})
            },
            orderBy: { createdAt: 'asc' }
        });
    },

    /**
     * Get RSVP counts
     */
    async getCounts(eventId: string) {
        const all = await prisma.zKEventRSVP.findMany({
            where: { eventId },
            select: { response: true }
        });

        const yes = all.filter((r: any) => r.response === 'YES').length;
        const no = all.filter((r: any) => r.response === 'NO').length;

        return { yes, no, total: all.length };
    }
};

export function rsvpChoiceToEnum(choice: string): 'yes' | 'no' {
    return choice.toUpperCase() === 'YES' ? 'yes' : 'no';
}
