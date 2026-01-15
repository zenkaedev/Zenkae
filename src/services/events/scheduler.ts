// src/services/events/scheduler.ts
import cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { Context } from '../../infra/context.js';
import { eventRSVP } from './rsvp.js';
import { logger } from '../../infra/logger.js';

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
            logger.info('Event scheduler already running');
            return;
        }

        // Run every 5 minutes
        schedulerTask = cron.schedule('*/5 * * * *', async () => {
            try {
                await this.checkEvents(client);
            } catch (err) {
                logger.error({ error: err }, 'Error in event scheduler tick');
            }
        });

        logger.info('Event scheduler initialized (runs every 5 minutes)');
    },

    /**
     * Stop the scheduler
     */
    stop() {
        if (schedulerTask) {
            schedulerTask.stop();
            schedulerTask = null;
            logger.info('Event scheduler stopped');
        }
    },

    /**
     * Main check loop - scans for events needing action
     */
    async checkEvents(client: Client) {
        const now = new Date();

        // === JOB 1: Publicar eventos agendados ===
        await this.publishScheduledEvents(client);

        // === JOB 2: Lock RSVP e enviar DMs (1h antes) ===
        await this.lockRsvpForUpcomingEvents(client);

        // === JOB 3: Cleanup e recorrência (+1h após início) ===
        await this.cleanupCompletedEvents(client);

        // === JOB 4: Announcement 24h antes (já existe) ===
        const events = await prisma.event.findMany({
            where: { status: 'scheduled', publishedAt: { not: null } },
            include: { rsvps: true, reminders: true }
        });

        for (const event of events) {
            const eventDate = new Date(event.startsAt);
            const diff = eventDate.getTime() - now.getTime();
            const hoursUntil = diff / (1000 * 60 * 60);

            // 24h before: Post announcement (narrow window to prevent duplicates)
            if (hoursUntil <= 24 && hoursUntil > 23.5 && event.announcementChannelId && !event.reminders.some((r: any) => r.kind === '24h')) {
                await this.postAnnouncement(client, event);
                await prisma.eventReminder.create({
                    data: { eventId: event.id, kind: '24h' }
                });
            }
        }
    },

    /**
     * JOB 1: Publicar eventos agendados para 24h antes
     */
    async publishScheduledEvents(client: Client) {
        try {
            const { eventsStore } = await import('../../modules/events/store.js');
            const { eventPublicPayload } = await import('../../modules/events/panel.js');

            const eventsToPublish = await eventsStore.listScheduledForPublication();

            for (const event of eventsToPublish) {
                try {
                    const channel = await client.channels.fetch(event.channelId);
                    if (!channel?.isTextBased()) continue;

                    // Reconstruct payload
                    const payload = eventPublicPayload({
                        title: event.title,
                        description: event.description || '',
                        startsAt: new Date(event.startsAt),
                        bannerUrl: event.imageUrl || null,
                        recurrence: (event.recurrence as 'WEEKLY' | 'NONE') || 'NONE',
                        zkReward: event.zkReward,
                        voiceChannelId: event.voiceChannelId || null,
                    }, event.id);

                    const msg = await (channel as any).send(payload);

                    // Update event with real message ID and mark as published
                    await eventsStore.update(event.id, { messageId: msg.id });
                    await eventsStore.markPublished(event.id);

                    logger.info({ eventId: event.id, title: event.title }, 'Published scheduled event');
                } catch (err) {
                    logger.error({ err, eventId: event.id }, 'Failed to publish scheduled event');
                }
            }
        } catch (err) {
            logger.error({ err }, 'Error in publishScheduledEvents job');
        }
    },

    /**
     * JOB 2: Lock RSVP e enviar DMs (1h antes do evento)
     */
    async lockRsvpForUpcomingEvents(client: Client) {
        try {
            const { eventsStore } = await import('../../modules/events/store.js');
            const events = await eventsStore.listEventsNeedingRsvpLock();

            for (const event of events) {
                // Se já foi travado, skip
                if (event.rsvpLockedAt) continue;

                await this.lockAndNotify(client, event);
                await eventsStore.markRsvpLocked(event.id);

                logger.info({ eventId: event.id }, 'Locked RSVP for upcoming event');
            }
        } catch (err) {
            logger.error({ err }, 'Error in lockRsvpForUpcomingEvents job');
        }
    },

    /**
     * JOB 3: Cleanup e recorrência (+1h após início)
     */
    async cleanupCompletedEvents(client: Client) {
        try {
            const { eventsStore } = await import('../../modules/events/store.js');
            const events = await eventsStore.listEventsForCleanup();

            for (const event of events) {
                await this.checkAttendance(client, event);
                logger.info({ eventId: event.id }, 'Cleaned up completed event');
            }
        } catch (err) {
            logger.error({ err }, 'Error in cleanupCompletedEvents job');
        }
    },

    async postAnnouncement(client: Client, event: any) {
        try {
            if (!event.announcementChannelId) return;
            const channel = await client.channels.fetch(event.announcementChannelId) as TextChannel;
            if (!channel) return;

            const eventDateStr = new Date(event.startsAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            const embed = new EmbedBuilder()
                .setTitle(`🔔 Lembrete: ${event.title}`)
                .setDescription(`O evento começa em menos de 24 horas!\n\n${event.description || ''}`)
                .setColor(0x6d28d9)
                .addFields(
                    { name: '📅 Data/Hora', value: eventDateStr, inline: true }
                );

            if (event.imageUrl) embed.setImage(event.imageUrl);

            await channel.send({ embeds: [embed] });
            logger.info({ eventId: event.id, title: event.title }, 'Posted 24h announcement');
        } catch (err) {
            logger.error({ err, eventId: event.id }, 'Failed to post 24h announcement');
        }
    },

    async lockAndNotify(client: Client, event: any) {
        // 1. Send DMs to YES rsvps
        try {
            const confirmed = event.rsvps.filter((r: any) => r.choice === 'yes');
            for (const rsvp of confirmed) {
                try {
                    const user = await client.users.fetch(rsvp.userId);
                    let msg = event.dmMessage || `🔔 **Lembrete:** O evento **${event.title}** começa em 1 hora!`;
                    // Replace variables
                    msg = msg.replace(/{user}/g, user.displayName).replace(/{user_mention}/g, `<@${user.id}>`);
                    await user.send(msg);
                } catch (err) {
                    logger.warn({ err, userId: rsvp.userId, eventId: event.id }, 'Failed to send DM to user');
                }
            }
            logger.info({ eventId: event.id, eventTitle: event.title, userCount: confirmed.length }, 'Notified users for event');
        } catch (err) {
            logger.error({ error: err, eventId: event.id }, 'Error in lockAndNotify (DMs)');
        }

        // 2. Lock Voting (Disable Buttons)
        try {
            if (event.channelId && event.messageId) {
                const channel = await client.channels.fetch(event.channelId) as TextChannel;
                if (channel?.isTextBased()) {
                    const message = await channel.messages.fetch(event.messageId);
                    if (message) {
                        // Rebuild components with disabled buttons
                        const rows = message.components.map((comp: any) => {
                            const newRow = ActionRowBuilder.from(comp as any);
                            newRow.components.forEach((btn: any) => {
                                if (btn.setDisabled) btn.setDisabled(true);
                            });
                            return newRow;
                        });

                        // Add "Inscrições encerradas" to footer or content
                        const embed = EmbedBuilder.from(message.embeds[0]);
                        const currentFooter = embed.data.footer?.text || '';
                        embed.setFooter({ text: `${currentFooter} • 🔒 Inscrições Encerradas` });

                        await message.edit({ embeds: [embed], components: rows as any });
                    }
                }
            }
        } catch (err) {
            logger.error({ error: err, eventId: event.id }, 'Error in lockAndNotify (Locking)');
        }
    },

    async checkAttendance(client: Client, event: any) {
        try {
            const guild = client.guilds.cache.get(event.guildId);
            if (!guild) return;

            // If voice channel is set, check attendance logic
            if (event.voiceChannelId) {
                const voiceChannel = guild.channels.cache.get(event.voiceChannelId);
                if (voiceChannel && voiceChannel.isVoiceBased()) {
                    // Attendance was checked, but no rewards are issued now.
                }
            }

            // Handle Recurrence
            if (event.recurrence === 'WEEKLY') {
                try {
                    const nextDate = new Date(event.startsAt);
                    nextDate.setDate(nextDate.getDate() + 7);

                    const { eventPublicPayload } = await import('../../modules/events/panel.js');

                    // Create next event
                    const nextEvent = await prisma.event.create({
                        data: {
                            guildId: event.guildId,
                            title: event.title,
                            description: event.description,
                            startsAt: nextDate,
                            channelId: event.channelId,
                            messageId: 'pending', // Will be updated
                            imageUrl: event.imageUrl,
                            voiceChannelId: event.voiceChannelId,
                            zkReward: event.zkReward,
                            recurrence: 'WEEKLY',
                            dmMessage: event.dmMessage,
                            announcementChannelId: event.announcementChannelId
                        }
                    });

                    // Post new message
                    if (event.channelId) {
                        const channel = await client.channels.fetch(event.channelId) as TextChannel;
                        if (channel) {
                            const payload = eventPublicPayload(nextEvent as any, nextEvent.id);
                            const msg = await channel.send(payload);
                            await prisma.event.update({
                                where: { id: nextEvent.id },
                                data: { messageId: msg.id }
                            });
                        }
                    }
                    logger.info({ oldId: event.id, newId: nextEvent.id }, 'Recurred event created');
                } catch (recurErr) {
                    logger.error({ error: recurErr, eventId: event.id }, 'Failed to recur event');
                }
            }

            // Mark completed
            await prisma.event.update({
                where: { id: event.id },
                data: { status: 'completed' }
            });
        } catch (err) {
            logger.error({ error: err, eventId: event.id }, 'Error checking attendance');
        }
    }
};
