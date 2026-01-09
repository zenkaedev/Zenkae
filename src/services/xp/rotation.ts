
import { Context } from '../../infra/context.js';
import { periodUtils } from './period.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

const logger = new Proxy({} as any, {
    get: (_, prop) => (Context.get().logger as any)[prop],
});

export const rotationService = {
    /**
     * Verifica se houve virada de semana/mês e processa rotação
     */
    async checkRotations(guildId: string) {
        const settings = await prisma.rankSettings.findUnique({ where: { guildId } });
        if (!settings) return;

        const currentWeekStart = periodUtils.getCurrentWeekStart();
        const currentMonthStart = periodUtils.getCurrentMonthStart();

        // --- Weekly Rotation ---
        if (!settings.lastWeeklyRotation || settings.lastWeeklyRotation < currentWeekStart) {
            await this.processRotation(guildId, 'WEEKLY', settings.weeklyRoleId);

            await prisma.rankSettings.update({
                where: { guildId },
                data: { lastWeeklyRotation: currentWeekStart }
            });

            await this.pruneOldData(guildId);
        }

        // --- Monthly Rotation ---
        if (!settings.lastMonthlyRotation || settings.lastMonthlyRotation < currentMonthStart) {
            await this.processRotation(guildId, 'MONTHLY', settings.monthlyRoleId);

            await prisma.rankSettings.update({
                where: { guildId },
                data: { lastMonthlyRotation: currentMonthStart }
            });
        }
    },

    /**
     * Processa a lógica de: tirar cargo do antigo top 1 -> dar cargo pro novo top 1
     */
    async processRotation(guildId: string, type: 'WEEKLY' | 'MONTHLY', roleId: string | null) {
        if (!roleId) return;

        const client = Context.get().client;
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        logger.info(`[RankRotation] Processing ${type} rotation for guild ${guild.name}`);

        let targetDate: Date;
        if (type === 'WEEKLY') {
            targetDate = periodUtils.getCurrentWeekStart();
            targetDate.setDate(targetDate.getDate() - 7); // Semana passada
        } else {
            targetDate = periodUtils.getCurrentMonthStart();
            targetDate.setMonth(targetDate.getMonth() - 1); // Mês passado
        }

        const topUser = await prisma.userXPPeriod.findFirst({
            where: {
                guildId,
                periodType: type,
                startDate: targetDate
            },
            orderBy: { xp: 'desc' },
        });

        try {
            const role = await guild.roles.fetch(roleId);
            if (role) {
                for (const [mid, member] of role.members) {
                    if (topUser && member.id === topUser.userId) continue;
                    await member.roles.remove(role).catch(() => { });
                }

                if (topUser) {
                    const winnerMember = await guild.members.fetch(topUser.userId).catch(() => null);
                    if (winnerMember) {
                        await winnerMember.roles.add(role);
                        logger.info(`[RankRotation] Role ${role.name} awarded to ${winnerMember.user.tag}`);
                    }
                }
            }
        } catch (err) {
            logger.error({ err }, `[RankRotation] Failed to rotate roles for ${type}`);
        }
    },

    async pruneOldData(guildId: string) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - (7 * 4));

        const res = await prisma.userXPPeriod.deleteMany({
            where: {
                guildId,
                periodType: 'WEEKLY',
                startDate: { lt: thresholdDate }
            }
        });

        if (res.count > 0) {
            logger.info(`[RankRotation] Pruned ${res.count} old weekly records`);
        }
    }
};
