// src/services/xp/store.ts
import { Context } from '../../infra/context.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * Sistema de XP com curva exponencial
 * Fórmula: XP_Necessario = 100 * (Nivel ^ 1.5)
 */
export const xpStore = {
    /**
     * Calcula XP necessário para o próximo nível
     */
    getXPForLevel(level: number): number {
        return Math.floor(100 * Math.pow(level, 1.5));
    },

    /**
     * Calcula nível baseado no XP total
     */
    getLevelFromXP(xpTotal: number): number {
        let level = 1;
        while (xpTotal >= this.getXPForLevel(level)) {
            xpTotal -= this.getXPForLevel(level);
            level++;
        }
        return level;
    },

    /**
     * Adiciona XP ao usuário (com cooldown de 60s para mensagens)
     * @returns {levelUp: boolean, newLevel: number, xpGained: number}
     */
    async addMessageXP(guildId: string, userId: string): Promise<{
        levelUp: boolean;
        newLevel: number;
        xpGained: number;
    }> {
        const now = new Date();
        const cooldownSeconds = 60;

        // Buscar ou criar registro
        let userLevel = await prisma.userLevel.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });

        if (!userLevel) {
            // Primeiro XP do usuário
            const xpGained = this.randomXP(15, 25);
            userLevel = await prisma.userLevel.create({
                data: {
                    guildId,
                    userId,
                    xpTotal: xpGained,
                    level: 1,
                    lastMessageAt: now,
                },
            });

            return { levelUp: false, newLevel: 1, xpGained };
        }

        // Verificar cooldown
        const lastMessage = new Date(userLevel.lastMessageAt);
        const secondsSinceLastMessage = (now.getTime() - lastMessage.getTime()) / 1000;

        if (secondsSinceLastMessage < cooldownSeconds) {
            // Ainda em cooldown, não ganha XP
            return { levelUp: false, newLevel: userLevel.level, xpGained: 0 };
        }

        // Ganhar XP
        const xpGained = this.randomXP(15, 25);
        const newXPTotal = userLevel.xpTotal + xpGained;
        const newLevel = this.getLevelFromXP(newXPTotal);
        const levelUp = newLevel > userLevel.level;

        // Atualizar banco
        await prisma.userLevel.update({
            where: { guildId_userId: { guildId, userId } },
            data: {
                xpTotal: newXPTotal,
                level: newLevel,
                lastMessageAt: now,
            },
        });

        return { levelUp, newLevel, xpGained };
    },

    /**
     * Adiciona XP por tempo em voz (10 XP por minuto)
     */
    async addVoiceXP(guildId: string, userId: string, minutes: number): Promise<void> {
        const xpGained = minutes * 10;

        const userLevel = await prisma.userLevel.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });

        if (!userLevel) {
            await prisma.userLevel.create({
                data: {
                    guildId,
                    userId,
                    xpTotal: xpGained,
                    level: this.getLevelFromXP(xpGained),
                },
            });
            return;
        }

        const newXPTotal = userLevel.xpTotal + xpGained;
        const newLevel = this.getLevelFromXP(newXPTotal);

        await prisma.userLevel.update({
            where: { guildId_userId: { guildId, userId } },
            data: {
                xpTotal: newXPTotal,
                level: newLevel,
            },
        });
    },

    /**
     * Busca dados de XP do usuário
     */
    async getUserLevel(guildId: string, userId: string) {
        const data = await prisma.userLevel.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });

        if (!data) {
            return {
                level: 1,
                xpTotal: 0,
                xpForNextLevel: this.getXPForLevel(1),
                xpProgress: 0,
            };
        }

        const xpForNextLevel = this.getXPForLevel(data.level);
        const xpInCurrentLevel = data.xpTotal - this.getTotalXPForLevel(data.level - 1);
        const xpProgress = (xpInCurrentLevel / xpForNextLevel) * 100;

        return {
            level: data.level,
            xpTotal: data.xpTotal,
            xpForNextLevel,
            xpProgress: Math.min(100, Math.max(0, xpProgress)),
        };
    },

    /**
     * Total de XP necessário para chegar em um nível
     */
    getTotalXPForLevel(level: number): number {
        let total = 0;
        for (let i = 1; i < level; i++) {
            total += this.getXPForLevel(i);
        }
        return total;
    },

    /**
     * Busca top usuários por XP
     */
    async getTopUsers(guildId: string, limit: number = 10) {
        return prisma.userLevel.findMany({
            where: { guildId },
            orderBy: { xpTotal: 'desc' },
            take: limit,
        });
    },

    /**
     * Busca posição do usuário no ranking
     */
    async getUserRank(guildId: string, userId: string): Promise<number> {
        const userLevel = await prisma.userLevel.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });

        if (!userLevel) return 0;

        const higherUsers = await prisma.userLevel.count({
            where: {
                guildId,
                xpTotal: { gt: userLevel.xpTotal },
            },
        });

        return higherUsers + 1;
    },

    /**
     * XP aleatório entre min e max
     */
    randomXP(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
};
