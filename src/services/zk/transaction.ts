// src/services/zk/transaction.ts
import { Context } from '../../infra/context.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * ZK Transaction Logging
 * Records all currency movements for audit trail
 */
export const zkTransaction = {
    /**
     * Log a ZK transaction
     */
    async log(
        guildId: string,
        userId: string,
        amount: number,
        reason: string,
        balanceBefore: number,
        balanceAfter: number
    ): Promise<void> {
        await prisma.zkTransaction.create({
            data: {
                guildId,
                userId,
                amount,
                reason,
                balanceBefore,
                balanceAfter
            }
        });
    },

    /**
     * Get transaction history for a user
     */
    async getUserHistory(guildId: string, userId: string, limit = 50) {
        return prisma.zkTransaction.findMany({
            where: { guildId, userId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    },

    /**
     * Get recent guild-wide transactions (for logs channel)
     */
    async getGuildHistory(guildId: string, limit = 50) {
        return prisma.zkTransaction.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }
};
