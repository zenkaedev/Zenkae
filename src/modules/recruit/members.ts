import { Client, EmbedBuilder, Guild, TextChannel, MessageFlags } from 'discord.js';
import { recruitStore } from './store.js';
import { logger } from '../../infra/logger.js';

export async function updateMembersPanel(guild: Guild) {
    try {
        const settings = await recruitStore.getSettings(guild.id);
        if (!settings.membersPanelChannelId) return; // Not configured

        const classes = recruitStore.parseClasses(settings.classes);
        if (classes.length === 0) return;

        // Fetch all members to ensure cache is hot (required for accurate role checking)
        await guild.members.fetch();

        const panel = await renderPanel(guild, classes);

        // Find or send message
        const channel = guild.channels.cache.get(settings.membersPanelChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) return;

        if (settings.membersPanelMessageId) {
            try {
                const msg = await channel.messages.fetch(settings.membersPanelMessageId);
                if (msg) {
                    await msg.edit(panel);
                    return;
                }
            } catch (e) {
                // Message lost
            }
        }

        // Create new
        const sent = await channel.send(panel);
        await recruitStore.updateSettings(guild.id, { membersPanelMessageId: sent.id });

    } catch (error) {
        logger.error({ error, guildId: guild.id }, 'Failed to update members panel');
    }
}

async function renderPanel(guild: Guild, classes: any[]): Promise<any> {
    const members = guild.members.cache;

    // Group by class
    // Map classId -> { class, members: [] }
    const groups = new Map<string, { class: any, members: string[] }>();

    // Initialize
    for (const c of classes) {
        if (c.roleId) groups.set(c.roleId, { class: c, members: [] });
    }

    // Distribute
    members.forEach(m => {
        if (m.user.bot) return; // Ignore bots
        // Check roles
        // A user might have multiple class roles? We usually pick the first one matching or all?
        // Let's add to all matching to be safe
        const memberRoles = m.roles.cache;
        for (const [roleId, group] of groups.entries()) {
            if (memberRoles.has(roleId)) {
                // Use Display Name (Nick)
                group.members.push(m.displayName);
            }
        }
    });

    // Build Embed
    const embed = new EmbedBuilder()
        .setTitle(`👥 ${guild.name} - Membros`)
        .setColor(0x2b2d31) // Dark theme
        // .setDescription('Lista de membros por classe / categoria.')
        .setTimestamp();

    // Sort groups? User didn't specify order, maybe defined order in settings (array order)
    // We used Map, so insertion order is preserved if we iterate array

    let totalCount = 0;

    for (const c of classes) {
        if (!c.roleId) continue;
        const g = groups.get(c.roleId);
        if (!g) continue;

        const count = g.members.length;
        totalCount += count;

        // Format list
        // Limit to avoid overflow. Field value limit is 1024.
        // Assuming avg name 15 chars, ~60 names.
        const MAX_SHOW = 40;
        const sortedNames = g.members.sort((a, b) => a.localeCompare(b));

        let listStr = sortedNames.slice(0, MAX_SHOW).join('\n');
        if (count > MAX_SHOW) {
            listStr += `\n...e mais ${count - MAX_SHOW}`;
        }
        if (count === 0) listStr = '_Sem membros_';

        const icon = c.emoji ? `${c.emoji} ` : '';
        embed.addFields({
            name: `${icon}${c.name} (${count})`,
            value: listStr,
            inline: true
        });
    }

    // Summary footer or description
    // User asked for summary at bottom: "Assassino: 2..."
    const summary = classes
        .filter(c => c.roleId && groups.has(c.roleId))
        .map(c => {
            const g = groups.get(c.roleId!);
            return `**${c.name}**: ${g?.members.length || 0}`;
        })
        .join('\n');

    embed.setDescription(`**Resumo da Guilda**\n${summary}`);

    return { content: '', embeds: [embed] };
}
