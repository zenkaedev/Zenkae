// src/services/zk/store.ts
import { prisma } from '../../prisma/client.js';
import { zkTransaction } from './transaction.js';

/**
 * ZK Points Balance Management
 * Core CRUD operations for user currency balances
 */
export const zkStore = {
    /**
     * Get user's current ZK balance
     */
    async getBalance(guildId: string, userId: string): Promise<number> {
        const record = await prisma.userZK.findUnique({
            where: { guildId_userId: { guildId, userId } }
        });
        return record?.balance ?? 0;
    },

    /**
     * Add ZK to user's balance (with transaction log)
     */
    async addZK(
        guildId: string,
        userId: string,
        amount: number,
        reason: string
    ): Promise<number> {
        const currentBalance = await this.getBalance(guildId, userId);
        const newBalance = currentBalance + amount;

        await prisma.userZK.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: {
                guildId,
                userId,
                balance: newBalance
            },
            update: {
                balance: newBalance
            }
        });

        // Log transaction
        await zkTransaction.log(
            guildId,
            userId,
            amount,
            reason,
            currentBalance,
            newBalance
        );

        return newBalance;
    },

    /**
     * Remove ZK from user's balance (with validation and transaction log)
     * Returns new balance or throws if insufficient funds
     */
    async removeZK(
        guildId: string,
        userId: string,
        amount: number,
        reason: string
    ): Promise<number> {
        const currentBalance = await this.getBalance(guildId, userId);

        if (currentBalance < amount) {
            throw new Error(`Insufficient balance. Has ${currentBalance}, needs ${amount}`);
        }

        const newBalance = currentBalance - amount;

        await prisma.userZK.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: newBalance }
        });

        // Log transaction (negative amount)
        await zkTransaction.log(
            guildId,
            userId,
            -amount,
            reason,
            currentBalance,
            newBalance
        );

        return newBalance;
    },

    /**
     * Set exact balance (admin use)
     */
    async setBalance(guildId: string, userId: string, amount: number): Promise<void> {
        await prisma.userZK.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: {
                guildId,
                userId,
                balance: amount
            },
            update: {
                balance: amount
            }
        });
    },

    /**
     * Check if user has sufficient balance
     */
    async hasBalance(guildId: string, userId: string, amount: number): Promise<boolean> {
        const balance = await this.getBalance(guildId, userId);
        return balance >= amount;
    },

    /**
     * Get top ZK holders (leaderboard)
     */
    async getTopZK(guildId: string, limit = 10) {
        return prisma.userZK.findMany({
            where: { guildId },
            orderBy: { balance: 'desc' },
            take: limit
        });
    }
};
