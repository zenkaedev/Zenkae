import { Client, Guild, TextChannel, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { recruitStore } from './store.js';
import { logger } from '../../infra/logger.js';
import { getBuilders } from '../../ui/v2.js';

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

    // Get V2 Builders
    const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = getBuilders();

    // Build with Components V2
    const container = new ContainerBuilder().setAccentColor(0xFFA500); // Orange/Gold

    // Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# 👥 ${guild.name}\n*${totalMembers} membros ativos*`)
    );

    // Add each class with separator
    for (const c of classes) {
        if (!c.roleId) continue;
        const g = groups.get(c.roleId);
        if (!g) continue;

        const count = g.members.length;
        const sortedNames = g.members.sort((a, b) => a.localeCompare(b));

        // Add separator before each class
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const icon = c.emoji || '▪️';
        let content: string;

        if (count === 0) {
            content = `**${icon} ${c.name}** \`[${count}]\`\n_Nenhum membro_`;
        } else {
            const MAX_SHOW = 18;
            const displayNames = sortedNames.slice(0, MAX_SHOW);
            const namesList = displayNames.join('\n');

            if (count > MAX_SHOW) {
                content = `**${icon} ${c.name}** \`[${count}]\`\n${namesList}\n\n*+${count - MAX_SHOW} outros*`;
            } else {
                content = `**${icon} ${c.name}** \`[${count}]\`\n${namesList}`;
            }
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content)
        );
    }

    // Add refresh button
    const refreshButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('members:refresh')
            .setLabel('🔄 Atualizar Painel')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(refreshButton);

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}
