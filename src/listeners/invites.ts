import { Client, Events, Collection, Invite, Guild } from 'discord.js';
import { xpStore } from '../services/xp/store.js';
import { logger } from '../infra/logger.js';

// Cache local de invites
// GuildID -> InviteCode -> InviteData
const invitesCache = new Map<string, Collection<string, Invite>>();

export function registerInviteTracker(client: Client) {

    // Helper para atualizar o cache de uma guild
    const updateGuildInvites = async (guild: Guild) => {
        try {
            const invites = await guild.invites.fetch();
            invitesCache.set(guild.id, invites);
        } catch (err) {
            logger.warn({ err, guildId: guild.id }, 'Failed to fetch invites for guild');
        }
    };

    // 1. Ao iniciar, popula o cache
    client.once(Events.ClientReady, async (c) => {
        logger.info('📦 Caching invites...');
        for (const [guildId, guild] of c.guilds.cache) {
            await updateGuildInvites(guild);
        }
        logger.info('✅ Invites cached');
    });

    // 2. Monitorar criação de invites
    client.on(Events.InviteCreate, async (invite) => {
        const guild = invite.guild;
        if (!guild) return;

        // Simplesmente atualizando tudo para garantir consistência
        if (guild instanceof Guild) {
            await updateGuildInvites(guild);
        }
    });

    // 3. Monitorar deleção
    client.on(Events.InviteDelete, async (invite) => {
        const guild = invite.guild;
        if (!guild) return;

        if (guild instanceof Guild) {
            await updateGuildInvites(guild);
        }
    });

    // 4. Onde a mágica acontece: Alguém entrou
    client.on(Events.GuildMemberAdd, async (member) => {
        // Ignorar bots
        if (member.user.bot) return;

        const guild = member.guild;

        // Pegar estado anterior do cache
        const cachedInvites = invitesCache.get(guild.id) || new Collection();

        // Pegar estado atual
        let newInvites: Collection<string, Invite>;
        try {
            newInvites = await guild.invites.fetch();
        } catch (err) {
            logger.error({ err, guildId: guild.id }, 'Failed to fetch new invites on member join');
            return;
        }

        // Tentar encontrar qual invite foi usado
        // A lógica é: O invite que incrementou o número de usos
        const usedInvite = newInvites.find(inv => {
            const cachedInv = cachedInvites.get(inv.code);
            // Se existia antes e o uso aumentou
            if (cachedInv && (inv.uses || 0) > (cachedInv.uses || 0)) {
                return true;
            }
            return false;
        });

        // Atualizar cache imediatamente para o próximo
        invitesCache.set(guild.id, newInvites);

        if (usedInvite && usedInvite.inviter) {
            const inviterId = usedInvite.inviter.id;

            // Não dar XP se a pessoa convidou a si mesma (difícil checar alt, mas ok)
            if (inviterId === member.id) return;

            logger.info({
                guildId: guild.id,
                member: member.user.tag,
                inviter: usedInvite.inviter.tag,
                code: usedInvite.code
            }, 'Invite used - Awarding XP');

            try {
                // XP para o convidador (300-400 XP)
                const xpAmount = xpStore.randomXP(300, 400); // Reutilizando random helper se possível ou usando Math
                // Como randomXP está na interface mas implementado no store, usaremos randomXP do store
                // Oops, randomXP é public? Sim.

                await xpStore.addManualXP(guild.id, inviterId, xpAmount);
                logger.info({ inviterId, xpAmount }, 'Invite XP Granted');

            } catch (err) {
                logger.error({ err }, 'Failed to give Invite XP');
            }
        } else {
            logger.info({ member: member.user.tag }, 'Could not trace invite usage (vanity url or unknowns)');
        }
    });

    logger.info('✅ Invite Tracker registrado');
}
