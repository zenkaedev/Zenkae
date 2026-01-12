// src/services/xp/store.ts
import { prisma } from '../../prisma/client.js';
import { periodUtils } from './period.js';
import type { IXPStore } from './types.js';

/**
 * Sistema de XP com curva exponencial
 * Fórmula: XP_Necessario = 100 * (Nivel ^ 1.5)
 * Implements IXPStore interface for type-safety and testability (Fix #11)
 */
export const xpStore: IXPStore = {
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
        let xpNeededSoFar = 0;

        // Continua subindo de nível enquanto tiver XP suficiente
        while (true) {
            const xpNeededForNextLevel = this.getXPForLevel(level);
            if (xpNeededSoFar + xpNeededForNextLevel > xpTotal) {
                // Não tem XP suficiente para COMPLETAR o próximo nível
                break;
            }
            xpNeededSoFar += xpNeededForNextLevel;
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

        // XP Period
        await this.addPeriodXP(guildId, userId, xpGained);

        return { levelUp, newLevel, xpGained };
    },

    /**
     * Adiciona XP por tempo em voz (10 XP por minuto)
     */
    async addVoiceXP(guildId: string, userId: string, seconds: number): Promise<void> {
        const xpGained = Math.floor((seconds / 60) * 10);
        if (xpGained < 1) return;

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

        // XP Period
        await this.addPeriodXP(guildId, userId, xpGained);
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
                xpInCurrentLevel: 0,
                xpForNextLevel: this.getXPForLevel(1),
                xpProgress: 0,
            };
        }

        const xpForNextLevel = this.getXPForLevel(data.level);
        const xpInCurrentLevel = data.xpTotal - this.getTotalXPForLevel(data.level);
        const xpProgress = (xpInCurrentLevel / xpForNextLevel) * 100;

        return {
            level: data.level,
            xpTotal: data.xpTotal,
            xpInCurrentLevel,
            xpForNextLevel,
            xpProgress: Math.min(100, Math.max(0, xpProgress)),
        };
    },

    /**
     * Busca dados de XP de múltiplos usuários em uma única query (Fix #4)
     * Otimização crítica para evitar N+1 queries no rank command
     */
    async getBatchUserLevels(guildId: string, userIds: string[]): Promise<Map<string, any>> {
        const results = new Map<string, any>();

        // Single batch query ao invés de N queries individuais
        const data = await prisma.userLevel.findMany({
            where: {
                guildId,
                userId: { in: userIds },
            },
        });

        // Criar índice rápido com type annotation
        const dataMap = new Map(data.map((d: { userId: string }) => [d.userId, d]));

        // Processar todos os usuários
        for (const userId of userIds) {
            const userData = dataMap.get(userId) as { level: number; xpTotal: number } | undefined;

            if (!userData) {
                results.set(userId, {
                    level: 1,
                    xpTotal: 0,
                    xpInCurrentLevel: 0,
                    xpForNextLevel: this.getXPForLevel(1),
                    xpProgress: 0,
                });
                continue;
            }

            const xpForNextLevel = this.getXPForLevel(userData.level);
            const xpInCurrentLevel = userData.xpTotal - this.getTotalXPForLevel(userData.level);
            const xpProgress = (xpInCurrentLevel / xpForNextLevel) * 100;

            results.set(userId, {
                level: userData.level,
                xpTotal: userData.xpTotal,
                xpInCurrentLevel,
                xpForNextLevel,
                xpProgress: Math.min(100, Math.max(0, xpProgress)),
            });
        }

        return results;
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

    /**
     * Adiciona XP nos contadores de período (Semana/Mês)
     */
    async addPeriodXP(guildId: string, userId: string, xp: number) {
        if (xp <= 0) return;

        const weekStart = periodUtils.getCurrentWeekStart();
        const monthStart = periodUtils.getCurrentMonthStart();

        // Semana
        await prisma.userXPPeriod.upsert({
            where: {
                guildId_userId_periodType_startDate: {
                    guildId,
                    userId,
                    periodType: 'WEEKLY',
                    startDate: weekStart
                }
            },
            create: { guildId, userId, periodType: 'WEEKLY', startDate: weekStart, xp },
            update: { xp: { increment: xp } }
        });

        // Mês
        await prisma.userXPPeriod.upsert({
            where: {
                guildId_userId_periodType_startDate: {
                    guildId,
                    userId,
                    periodType: 'MONTHLY',
                    startDate: monthStart
                }
            },
            create: { guildId, userId, periodType: 'MONTHLY', startDate: monthStart, xp },
            update: { xp: { increment: xp } }
        });
    },

    async getPeriodTopUsers(guildId: string, type: 'WEEKLY' | 'MONTHLY', limit = 10) {
        const startDate = type === 'WEEKLY'
            ? periodUtils.getCurrentWeekStart()
            : periodUtils.getCurrentMonthStart();

        return prisma.userXPPeriod.findMany({
            where: {
                guildId,
                periodType: type,
                startDate
            },
            orderBy: { xp: 'desc' },
            take: limit
        });
    }
};
