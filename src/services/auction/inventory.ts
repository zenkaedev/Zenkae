// src/services/auction/inventory.ts
import { Context } from '../../infra/context.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * Auction Item Inventory Management
 */
export const auctionInventory = {
    /**
     * Create a new item in inventory
     */
    async createItem(
        guildId: string,
        name: string,
        description: string,
        imageUrl: string,
        zkCost: number
    ) {
        return prisma.auctionItem.create({
            data: {
                guildId,
                name,
                description,
                imageUrl,
                zkCost
            }
        });
    },

    /**
     * Get all items for a guild
     */
    async getItems(guildId: string) {
        return prisma.auctionItem.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' }
        });
    },

    /**
     * Get single item
     */
    async getItem(itemId: string) {
        return prisma.auctionItem.findUnique({
            where: { id: itemId }
        });
    },

    /**
     * Delete item from inventory
     */
    async deleteItem(itemId: string) {
        await prisma.auctionItem.delete({
            where: { id: itemId }
        });
    }
};
