import { Client, EmbedBuilder, Guild, TextChannel, MessageFlags } from 'discord.js';
import { recruitStore } from './store.js';
import { logger } from '../../infra/logger.js';

export async function updateMembersPanel(guild: Guild) {
    try {
        console.log(`[Members Panel] Starting update for guild ${guild.id}`);
        const settings = await recruitStore.getSettings(guild.id);

        if (!settings.membersPanelChannelId) {
            console.log(`[Members Panel] No channel configured, skipping update`);
            return;
        }

        const classes = recruitStore.parseClasses(settings.classes);
        console.log(`[Members Panel] Found ${classes.length} classes`);

        if (classes.length === 0) {
            console.log(`[Members Panel] No classes configured, skipping update`);
            return;
        }

        // Try to fetch members, but don't fail if rate limited
        try {
            console.log(`[Members Panel] Attempting to fetch members...`);
            await guild.members.fetch();
            console.log(`[Members Panel] Successfully fetched ${guild.members.cache.size} members`);
        } catch (fetchError: any) {
            if (fetchError.name === 'GatewayRateLimitError') {
                console.log(`[Members Panel] Rate limited on member fetch, using cache (${guild.members.cache.size} cached)`);
            } else {
                console.error(`[Members Panel] Error fetching members:`, fetchError);
            }
        }

        const panel = await renderPanel(guild, classes);
        console.log(`[Members Panel] Panel rendered successfully`);

        // Find or send message
        const channel = guild.channels.cache.get(settings.membersPanelChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            console.error(`[Members Panel] Channel ${settings.membersPanelChannelId} not found or not text-based`);
            return;
        }

        console.log(`[Members Panel] Target channel: ${channel.name}`);

        if (settings.membersPanelMessageId) {
            try {
                console.log(`[Members Panel] Attempting to edit existing message ${settings.membersPanelMessageId}`);
                const msg = await channel.messages.fetch(settings.membersPanelMessageId);
                if (msg) {
                    await msg.edit(panel);
                    console.log(`[Members Panel] Successfully updated existing message`);
                    return;
                }
            } catch (e) {
                console.log(`[Members Panel] Existing message not found, will create new one`);
            }
        }

        // Create new
        console.log(`[Members Panel] Creating new panel message`);
        const sent = await channel.send(panel);
        await recruitStore.updateSettings(guild.id, { membersPanelMessageId: sent.id });
        console.log(`[Members Panel] Panel created successfully with ID ${sent.id}`);

    } catch (error) {
        console.error('[Members Panel] ERROR:', error);
        logger.error({ error, guildId: guild.id }, 'Failed to update members panel');
    }
}

async function renderPanel(guild: Guild, classes: any[]): Promise<any> {
    const members = guild.members.cache;

    // Group by class
    const groups = new Map<string, { class: any, members: string[] }>();

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

    // Build modern description with stats
    const classStats = classes
        .filter(c => c.roleId && groups.has(c.roleId))
        .map(c => {
            const g = groups.get(c.roleId!);
            const count = g?.members.length || 0;
            const icon = c.emoji || '▪️';
            return `${icon} **${count}**`;
        })
        .join('  ·  ');

    // Build Embed - Modern & Clean
    const embed = new EmbedBuilder()
        .setTitle(`👥 ${guild.name}`) // NO # - doesn't work in embed titles
        .setDescription(`${classStats}\n━━━━━━━━━━━━━━━━━━━━`) // Visual separator
        .setColor(0xFFA500) // Orange/Gold
        .setFooter({ text: `${totalMembers} membros ativos` })
        .setTimestamp();

    // Add fields for each class with modern spacing
    for (const c of classes) {
        if (!c.roleId) continue;
        const g = groups.get(c.roleId);
        if (!g) continue;

        const count = g.members.length;
        const sortedNames = g.members.sort((a, b) => a.localeCompare(b));

        let fieldValue: string;

        if (count === 0) {
            fieldValue = '```\nNenhum membro\n```';
        } else {
            const MAX_SHOW = 18;
            const displayNames = sortedNames.slice(0, MAX_SHOW);

            // Modern spaced list with breathing room
            const namesList = displayNames.join('\n');

            if (count > MAX_SHOW) {
                fieldValue = `${namesList}\n\n*+${count - MAX_SHOW} outros*`;
            } else {
                fieldValue = namesList;
            }
        }

        const icon = c.emoji || '▪️';

        embed.addFields({
            name: `${icon} ${c.name}`,
            value: fieldValue,
            inline: true
        });
    }

    return { embeds: [embed] };
}
