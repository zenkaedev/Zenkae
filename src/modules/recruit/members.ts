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

        // Fetch all members to ensure cache is hot (required for accurate role checking)
        await guild.members.fetch();
        console.log(`[Members Panel] Fetched ${guild.members.cache.size} members`);

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

    // Build Embed
    const embed = new EmbedBuilder()
        .setTitle(`# ${guild.name}`) // Large title with #
        .setColor(0xFFD700) // Gold/Yellow theme
        .setFooter({ text: `Total de Membros: ${totalMembers}` })
        .setTimestamp();

    // Add fields for each class with container aesthetic
    for (const c of classes) {
        if (!c.roleId) continue;
        const g = groups.get(c.roleId);
        if (!g) continue;

        const count = g.members.length;
        const sortedNames = g.members.sort((a, b) => a.localeCompare(b));

        // Build container-style box
        const icon = c.emoji || '•';
        const header = `[ ${icon} ${c.name.toUpperCase()} ]`;
        const separator = '─'.repeat(20);

        let box = `${header}${separator}\n`;

        if (count === 0) {
            box += `│ Sem membros\n`;
        } else {
            const MAX_SHOW = 15; // Reduced to keep it clean
            const displayNames = sortedNames.slice(0, MAX_SHOW);

            displayNames.forEach(name => {
                box += `│ ${name}\n`;
            });

            if (count > MAX_SHOW) {
                box += `│ ... e mais ${count - MAX_SHOW}\n`;
            }
        }

        box += `└${'─'.repeat(header.length + separator.length - 1)}`;

        // Wrap in code block for container effect
        const fieldValue = `\`\`\`\n${box}\n\`\`\``;

        embed.addFields({
            name: `${icon} ${c.name} (${count})`,
            value: fieldValue,
            inline: true
        });
    }

    return { embeds: [embed] };
}
