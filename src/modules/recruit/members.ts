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

    // Header - NO EMOJI, add "Membros"
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${guild.name} Membros\n*${totalMembers} membros ativos*`)
    );

    // Group classes in sets of 3 for column-like display
    const COLS = 3;
    for (let i = 0; i < classes.length; i += COLS) {
        const chunk = classes.slice(i, i + COLS);

        // Add separator before each row
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Build content for this "row" (3 columns side by side)
        const columns: string[] = [];

        for (const c of chunk) {
            if (!c.roleId) {
                columns.push(''); // Empty column
                continue;
            }

            const g = groups.get(c.roleId);
            if (!g) {
                columns.push('');
                continue;
            }

            const count = g.members.length;
            const sortedNames = g.members.sort((a, b) => a.localeCompare(b));
            const icon = c.emoji || '▪️';

            let columnContent = `**${icon} ${c.name}** \`[${count}]\`\n`;

            if (count === 0) {
                columnContent += '_Nenhum membro_';
            } else {
                const MAX_SHOW = 10; // Reduced for multi-column
                const displayNames = sortedNames.slice(0, MAX_SHOW);
                const namesList = displayNames.join('\n');

                if (count > MAX_SHOW) {
                    columnContent += `${namesList}\n*+${count - MAX_SHOW}*`;
                } else {
                    columnContent += namesList;
                }
            }

            columns.push(columnContent);
        }

        // Combine columns horizontally (side by side)
        // Split each column into lines and interleave
        const splitColumns = columns.map(col => col.split('\n'));
        const maxLines = Math.max(...splitColumns.map(c => c.length));

        let combinedContent = '';
        for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
            const lineParts: string[] = [];
            for (let colIdx = 0; colIdx < COLS; colIdx++) {
                const line = splitColumns[colIdx]?.[lineIdx] || '';
                lineParts.push(line.padEnd(35)); // Pad for alignment
            }
            combinedContent += lineParts.join('  ') + '\n';
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(combinedContent.trim())
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
