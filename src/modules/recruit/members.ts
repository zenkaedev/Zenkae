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

    // Build summary for top section
    const summary = classes
        .filter(c => c.roleId && groups.has(c.roleId))
        .map(c => {
            const g = groups.get(c.roleId!);
            return `**${c.name}**: ${g?.members.length || 0}`;
        })
        .join(' • ');

    // Build class sections
    const sections: string[] = [];
    for (const c of classes) {
        if (!c.roleId) continue;
        const g = groups.get(c.roleId);
        if (!g) continue;

        const count = g.members.length;
        const sortedNames = g.members.sort((a, b) => a.localeCompare(b));

        const MAX_SHOW = 30;
        let listStr = sortedNames.slice(0, MAX_SHOW).join(', ');
        if (count > MAX_SHOW) {
            listStr += ` (+${count - MAX_SHOW} mais)`;
        }
        if (count === 0) listStr = '_Sem membros_';

        const icon = c.emoji ? `${c.emoji} ` : '';
        sections.push(`**${icon}${c.name}** (${count})\n${listStr}`);
    }

    // Use Components V2
    const { ContainerBuilder, TextDisplayBuilder } = (await import('../../ui/v2.js')).getBuilders();

    if (!ContainerBuilder || !TextDisplayBuilder) {
        // Fallback to embeds if V2 not available (shouldn't happen)
        const { EmbedBuilder } = await import('discord.js');
        const embed = new EmbedBuilder()
            .setTitle(`👥 ${guild.name} - Membros`)
            .setDescription(`**Resumo:** ${summary}`)
            .setColor(0x6d28d9)
            .setTimestamp();

        for (const c of classes) {
            if (!c.roleId) continue;
            const g = groups.get(c.roleId);
            if (!g) continue;
            const count = g.members.length;
            const sortedNames = g.members.sort((a, b) => a.localeCompare(b));
            const MAX_SHOW = 40;
            let listStr = sortedNames.slice(0, MAX_SHOW).join('\n');
            if (count > MAX_SHOW) listStr += `\n...e mais ${count - MAX_SHOW}`;
            if (count === 0) listStr = '_Sem membros_';
            const icon = c.emoji ? `${c.emoji} ` : '';
            embed.addFields({ name: `${icon}${c.name} (${count})`, value: listStr, inline: true });
        }
        return { content: '', embeds: [embed] };
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`# 👥 ${guild.name} - Membros\n\n${summary}\n\n` + sections.join('\n\n'))
        );

    return {
        components: [container],
        flags: 1 << 7 // IS_COMPONENTS_V2
    };
}
