import { Client, EmbedBuilder, Guild, TextChannel, MessageFlags } from 'discord.js';
import { recruitStore, type Class } from './store.js';
import { logger } from '../../infra/logger.js';
import { lifecycle } from '../../infra/lifecycle.js';

// Cache de members fetch com TTL
const membersFetchCache = new Map<string, number>();
const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutos

// Limpa cache expirado a cada 10 minutos - gerenciado pelo lifecycle
lifecycle.registerInterval(() => {
    const now = Date.now();
    for (const [guildId, timestamp] of membersFetchCache.entries()) {
        if (now - timestamp > FETCH_INTERVAL * 2) {
            membersFetchCache.delete(guildId);
        }
    }
}, FETCH_INTERVAL * 2, 'members-fetch-cache-cleanup');


export async function updateMembersPanel(guild: Guild) {
    try {
        logger.info({ guildId: guild.id }, 'Starting members panel update');
        const settings = await recruitStore.getSettings(guild.id);

        if (!settings.membersPanelChannelId) {
            logger.debug({ guildId: guild.id }, 'No members panel channel configured, skipping');
            return;
        }

        const classes = recruitStore.parseClasses(settings.classes);
        logger.debug({ guildId: guild.id, classCount: classes.length }, 'Classes parsed');

        if (classes.length === 0) {
            logger.debug({ guildId: guild.id }, 'No classes configured, skipping panel update');
            return;
        }

        // Smart cache: only fetch if needed
        const now = Date.now();
        const lastFetch = membersFetchCache.get(guild.id) || 0;

        if (now - lastFetch > FETCH_INTERVAL) {
            try {
                logger.debug({ guildId: guild.id }, 'Attempting to fetch guild members');
                await guild.members.fetch();
                membersFetchCache.set(guild.id, now);
                logger.info({ guildId: guild.id, memberCount: guild.members.cache.size }, 'Guild members fetched successfully');
            } catch (fetchError: any) {
                if (fetchError.name === 'GatewayRateLimitError') {
                    logger.warn({ guildId: guild.id, cachedCount: guild.members.cache.size }, 'Rate limited on member fetch, using cache');
                } else {
                    logger.error({ guildId: guild.id, error: fetchError }, 'Error fetching members');
                }
            }
        } else {
            logger.debug({ guildId: guild.id, cachedCount: guild.members.cache.size }, 'Using cached members (fetch within TTL)');
        }

        const panel = await renderPanel(guild, classes);
        logger.debug({ guildId: guild.id }, 'Members panel rendered');

        // Find or send message
        const channel = guild.channels.cache.get(settings.membersPanelChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            logger.error({ guildId: guild.id, channelId: settings.membersPanelChannelId }, 'Members panel channel not found or not text-based');
            return;
        }

        logger.debug({ guildId: guild.id, channelName: channel.name }, 'Target channel found');

        if (settings.membersPanelMessageId) {
            try {
                logger.debug({ guildId: guild.id, messageId: settings.membersPanelMessageId }, 'Attempting to edit existing panel message');
                const msg = await channel.messages.fetch(settings.membersPanelMessageId);
                if (msg) {
                    await msg.edit(panel);
                    logger.info({ guildId: guild.id, messageId: settings.membersPanelMessageId }, 'Members panel updated successfully');
                    return;
                }
            } catch (e) {
                logger.debug({ guildId: guild.id }, 'Existing panel message not found, will create new one');
            }
        }

        // Create new
        logger.debug({ guildId: guild.id }, 'Creating new members panel message');
        const sent = await channel.send(panel);
        await recruitStore.updateSettings(guild.id, { membersPanelMessageId: sent.id });
        logger.info({ guildId: guild.id, messageId: sent.id }, 'Members panel created successfully');

    } catch (error) {
        logger.error({ error, guildId: guild.id }, 'Failed to update members panel');
    }
}

async function renderPanel(guild: Guild, classes: Class[]): Promise<{ embeds: EmbedBuilder[] }> {
    const members = guild.members.cache;

    // Group by class
    const groups = new Map<string, { class: Class, members: string[] }>();

    // Initialize
    for (const c of classes) {
        if (c.roleId) groups.set(c.roleId, { class: c, members: [] });
    }

    // Distribute
    members.forEach(m => {
        if (m.user.bot) return; // Ignore bots
        const memberRoles = m.roles.cache;
        for (const [roleId, group] of groups.entries()) {
            if (memberRoles.has(roleId)) {
                group.members.push(m.displayName);
            }
        }
    });

    // Calculate total members
    let totalMembers = 0;
    groups.forEach(g => {
        totalMembers += g.members.length;
    });

    // Build Embed - Clean with 3 columns
    const embed = new EmbedBuilder()
        .setDescription(`# ${guild.name} Membros`)
        .setColor(0xFFA500) // Orange/Gold
        .setFooter({ text: `${totalMembers} membros ativos` })
        .setTimestamp();

    // Add fields for each class (inline = 3 columns automatically)
    for (const c of classes) {
        if (!c.roleId) continue;
        const g = groups.get(c.roleId);
        if (!g) continue;

        const count = g.members.length;
        const sortedNames = g.members.sort((a, b) => a.localeCompare(b));

        let fieldValue: string;

        if (count === 0) {
            fieldValue = '_Nenhum membro_';
        } else {
            const MAX_SHOW = 12; // Good for 3-column layout
            const displayNames = sortedNames.slice(0, MAX_SHOW);
            const namesList = displayNames.join('\n');

            if (count > MAX_SHOW) {
                fieldValue = `${namesList}\n\n*+${count - MAX_SHOW} outros*`;
            } else {
                fieldValue = namesList;
            }
        }

        const icon = c.emoji || '▪️';

        embed.addFields({
            name: `${icon} ${c.name} [${count}]`,
            value: fieldValue,
            inline: true // This creates 3-column layout
        });
    }

    return { embeds: [embed] };
}
