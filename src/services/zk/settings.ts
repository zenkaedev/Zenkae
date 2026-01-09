// src/services/zk/settings.ts
import { Context } from '../../infra/context.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * Guild Settings for ZK Currency System
 * Manages customizable currency names and configuration
 */
export const zkSettings = {
    /**
     * Get custom currency name for guild (default: "ZK Points")
     */
    async getCurrencyName(guildId: string): Promise<string> {
        const settings = await prisma.guildSettings.findUnique({
            where: { guildId },
            select: { currencyName: true }
        });
        return settings?.currencyName ?? 'ZK Points';
    },

    /**
     * Get custom currency symbol for guild (default: "ZK")
     */
    async getCurrencySymbol(guildId: string): Promise<string> {
        const settings = await prisma.guildSettings.findUnique({
            where: { guildId },
            select: { currencySymbol: true }
        });
        return settings?.currencySymbol ?? 'ZK';
    },

    /**
     * Update currency branding for guild
     */
    async updateCurrency(guildId: string, name: string, symbol: string): Promise<void> {
        await prisma.guildSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                currencyName: name,
                currencySymbol: symbol
            },
            update: {
                currencyName: name,
                currencySymbol: symbol
            }
        });
    },

    /**
     * Get configured logs channel ID
     */
    async getLogsChannel(guildId: string): Promise<string | null> {
        const settings = await prisma.guildSettings.findUnique({
            where: { guildId },
            select: { logsChannelId: true }
        });
        return settings?.logsChannelId ?? null;
    },

    /**
     * Set logs channel for guild
     */
    async setLogsChannel(guildId: string, channelId: string): Promise<void> {
        await prisma.guildSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                logsChannelId: channelId
            },
            update: {
                logsChannelId: channelId
            }
        });
    }
};
