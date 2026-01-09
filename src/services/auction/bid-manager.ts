// src/services/auction/bid-manager.ts
import { Context } from '../../infra/context.js';
import { zkStore } from '../zk/store.js';
import { xpStore } from '../xp/store.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * Auction Bid Management with XP-based Tiebreaker
 */
export const bidManager = {
    /**
     * Place a bid (record interest)
     */
    async placeBid(guildId: string, itemId: string, userId: string): Promise<{ success: boolean; message: string }> {
        // Get item
        const item = await prisma.auctionItem.findUnique({
            where: { id: itemId }
        });

        if (!item) {
            return { success: false, message: 'Item não encontrado' };
        }

        // Check if user has enough ZK
        const balance = await zkStore.getBalance(guildId, userId);
        if (balance < item.zkCost) {
            return {
                success: false,
                message: `Saldo insuficiente. Você tem ${balance} ZK, precisa de ${item.zkCost} ZK.`
            };
        }

        // Get user's XP level for tiebreaker
        const xpData = await xpStore.getUserLevel(guildId, userId);

        // Record bid
        await prisma.auctionBid.upsert({
            where: { itemId_userId: { itemId, userId } },
            create: {
                guildId,
                itemId,
                userId,
                userXPLevel: xpData.level
            },
            update: {
                userXPLevel: xpData.level
            }
        });

        return { success: true, message: 'Lance registrado!' };
    },

    /**
     * Get all bids for an item
     */
    async getBids(itemId: string) {
        return prisma.auctionBid.findMany({
            where: { itemId },
            orderBy: { userXPLevel: 'desc' }
        });
    },

    /**
     * Close auction and determine winner
     * Tiebreaker: 1) Has ZK balance, 2) Highest XP level
     */
    async closeAuction(guildId: string, itemId: string): Promise<{
        success: boolean;
        winnerId?: string;
        winnerName?: string;
        message: string;
    }> {
        const item = await prisma.auctionItem.findUnique({
            where: { id: itemId },
            include: { bids: true }
        });

        if (!item) {
            return { success: false, message: 'Item não encontrado' };
        }

        if (item.bids.length === 0) {
            return { success: false, message: 'Nenhum lance foi feito' };
        }

        // Filter candidates who can afford
        const candidates = [];
        for (const bid of item.bids) {
            const balance = await zkStore.getBalance(guildId, bid.userId);
            if (balance >= item.zkCost) {
                candidates.push({ ...bid, balance });
            }
        }

        if (candidates.length === 0) {
            return { success: false, message: 'Nenhum participante tem saldo suficiente' };
        }

        // Sort by XP level (desc)
        candidates.sort((a, b) => b.userXPLevel - a.userXPLevel);

        const winner = candidates[0];

        // Deduct ZK
        await zkStore.removeZK(
            guildId,
            winner.userId,
            item.zkCost,
            `Leilão: ${item.name}`
        );

        // Delete all bids for this item
        await prisma.auctionBid.deleteMany({
            where: { itemId }
        });

        return {
            success: true,
            winnerId: winner.userId,
            message: `<@${winner.userId}> venceu o leilão com level ${winner.userXPLevel}!`
        };
    },

    /**
     * Cancel auction (delete all bids without charging)
     */
    async cancelAuction(itemId: string) {
        await prisma.auctionBid.deleteMany({
            where: { itemId }
        });
    }
};
