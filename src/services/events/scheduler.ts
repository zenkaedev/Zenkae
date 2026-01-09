// src/services/events/scheduler.ts
import cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Context } from '../../infra/context.js';
import { zkStore } from '../zk/store.js';
import { zkSettings } from '../zk/settings.js';
import { eventRSVP } from './rsvp.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

let schedulerTask: cron.ScheduledTask | null = null;

/**
 * Event Scheduler - Automated Timeline Management
 * Checks every 5 minutes for events that need action
 */
export const eventScheduler = {
    /**
     * Initialize the scheduler (call when bot starts)
     */
    init(client: Client) {
        if (schedulerTask) {
            console.log('[EVENT SCHEDULER] Already running');
            return;
        }

        // Run every 5 minutes
        schedulerTask = cron.schedule('*/5 * * * *', async () => {
            try {
                await this.checkEvents(client);
            } catch (err) {
                console.error('[EVENT SCHEDULER] Error:', err);
            }
        });

        console.log('✅ [EVENT SCHEDULER] Initialized (runs every 5 minutes)');
    },

    /**
     * Stop the scheduler
     */
    stop() {
        if (schedulerTask) {
            schedulerTask.stop();
            schedulerTask = null;
            console.log('[EVENT SCHEDULER] Stopped');
        }
    },

    /**
     * Main check loop - scans for events needing action
     */
    async checkEvents(client: Client) {
        const now = new Date();

        // Find incomplete events
        const events = await prisma.zKEvent.findMany({
            where: { completed: false },
            include: { rsvps: true }
        });

        for (const event of events) {
            const eventDate = new Date(event.eventDate);
            const diff = eventDate.getTime() - now.getTime();
            const hoursUntil = diff / (1000 * 60 * 60);

            // 24h before: Post announcement
            if (hoursUntil <= 24 && hoursUntil > 23 && !event.announcementMessageId) {
                await this.postAnnouncement(client, event);
            }

            // 1h before: Lock RSVP, send DMs, post final list
            if (hoursUntil <= 1 && hoursUntil > 0.9 && !event.rsvpLocked) {
                await this.lockAndNotify(client, event);
            }

            // Event time: Check attendance and award ZK
            if (diff <= 0 && !event.completed) {
                await this.checkAttendance(client, event);
            }
        }
    },

    /**
     * 24h before: Post event announcement with RSVP buttons
     */
    async postAnnouncement(client: Client, event: any) {
        try {
            const guild = client.guilds.cache.get(event.guildId);
            if (!guild) return;

            // Try to find announcements/events channel
            const channel = guild.channels.cache.find(
                c => c.isTextBased() &&
                    (c.name.includes('evento') || c.name.includes('anuncio') || c.name.includes('geral'))
            ) as TextChannel;

            if (!channel) {
                console.warn(`[SCHEDULER] No announcement channel found for guild ${event.guildId}`);
                return;
            }

            const currencySymbol = await zkSettings.getCurrencySymbol(event.guildId);
            const eventDateStr = new Date(event.eventDate).toLocaleString('pt-BR');

            const embed = new EmbedBuilder()
                .setTitle(`🎉 ${event.title}`)
                .setDescription(event.description)
                .setColor(0x6d28d9)
                .addFields(
                    { name: '📅 Data/Hora', value: eventDateStr, inline: true },
                    { name: '💰 Recompensa', value: `${event.zkReward} ${currencySymbol}`, inline: true }
                )
                .setFooter({ text: 'Confirme sua presença abaixo!' });

            if (event.imageUrl) {
                embed.setImage(event.imageUrl);
            }

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`event_rsvp_yes_${event.id}`)
                        .setLabel('✅ Vou Participar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`event_rsvp_no_${event.id}`)
                        .setLabel('❌ Não Vou')
                        .setStyle(ButtonStyle.Danger)
                );

            const message = await channel.send({ embeds: [embed], components: [row] });

            // Save message ID
            await prisma.zKEvent.update({
                where: { id: event.id },
                data: {
                    announcementMessageId: message.id,
                    announcementChannelId: channel.id
                }
            });

            console.log(`[SCHEDULER] Posted announcement for event: ${event.title}`);
        } catch (err) {
            console.error('[SCHEDULER] Error posting announcement:', err);
        }
    },

    /**
     * 1h before: Lock RSVP, send DMs, post final list
     */
    async lockAndNotify(client: Client, event: any) {
        try {
            const guild = client.guilds.cache.get(event.guildId);
            if (!guild) return;

            // Lock RSVP
            await prisma.zKEvent.update({
                where: { id: event.id },
                data: { rsvpLocked: true }
            });

            // Get confirmed users
            const confirmed = await eventRSVP.getRSVPList(event.id, 'YES');

            // Send DMs
            for (const rsvp of confirmed) {
                try {
                    const user = await client.users.fetch(rsvp.userId);
                    await user.send(event.dmMessage);
                } catch (err) {
                    console.warn(`[SCHEDULER] Could not DM user ${rsvp.userId}:`, err);
                }
            }

            // Post final list
            if (event.announcementChannelId) {
                const channel = guild.channels.cache.get(event.announcementChannelId) as TextChannel;
                if (channel) {
                    const confirmedList = confirmed.length > 0
                        ? confirmed.map((r: any) => `<@${r.userId}>`).join(', ')
                        : 'Ninguém confirmou presença';

                    const embed = new EmbedBuilder()
                        .setTitle(`📋 Lista Final - ${event.title}`)
                        .setDescription(`**Confirmados:** ${confirmedList}`)
                        .setColor(0x6d28d9)
                        .setFooter({ text: 'RSVPs travados. Boa sorte!' });

                    const finalMessage = await channel.send({ embeds: [embed] });

                    await prisma.zKEvent.update({
                        where: { id: event.id },
                        data: { finalListMessageId: finalMessage.id }
                    });
                }
            }

            console.log(`[SCHEDULER] Locked and notified for event: ${event.title}`);
        } catch (err) {
            console.error('[SCHEDULER] Error in lockAndNotify:', err);
        }
    },

    /**
     * Event time: Check voice attendance and award ZK
     */
    async checkAttendance(client: Client, event: any) {
        try {
            const guild = client.guilds.cache.get(event.guildId);
            if (!guild) return;

            const voiceChannel = guild.channels.cache.get(event.voiceChannelId);
            if (!voiceChannel || !voiceChannel.isVoiceBased()) {
                console.warn(`[SCHEDULER] Voice channel not found: ${event.voiceChannelId}`);
                await prisma.zKEvent.update({
                    where: { id: event.id },
                    data: { completed: true }
                });
                return;
            }

            // Get confirmed users
            const confirmed = await eventRSVP.getRSVPList(event.id, 'YES');

            // Get users currently in voice
            const voiceMembers = Array.from(voiceChannel.members.values());

            let awarded = 0;

            // Award ZK to users who confirmed AND are in voice
            for (const rsvp of confirmed) {
                const inVoice = voiceMembers.some((m: any) => m.id === rsvp.userId);
                if (inVoice) {
                    await zkStore.addZK(
                        event.guildId,
                        rsvp.userId,
                        event.zkReward,
                        `Evento: ${event.title}`
                    );
                    awarded++;
                }
            }

            // Mark event as completed
            await prisma.zKEvent.update({
                where: { id: event.id },
                data: { completed: true }
            });

            console.log(`[SCHEDULER] Event completed: ${event.title} (${awarded} users awarded)`);
        } catch (err) {
            console.error('[SCHEDULER] Error checking attendance:', err);
        }
    }
};
