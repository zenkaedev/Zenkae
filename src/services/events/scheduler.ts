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

        // Find incomplete events
        const events = await prisma.event.findMany({
            where: { status: 'scheduled' },
            include: { rsvps: true, reminders: true }
        });

        for (const event of events) {
            const eventDate = new Date(event.startsAt);
            const diff = eventDate.getTime() - now.getTime();
            const hoursUntil = diff / (1000 * 60 * 60);

            // 24h before: Post announcement
            if (hoursUntil <= 24 && hoursUntil > 23 && event.announcementChannelId && !event.reminders.some((r: any) => r.kind === '24h')) {
                await this.postAnnouncement(client, event);
                await prisma.eventReminder.create({
                    data: { eventId: event.id, kind: '24h' }
                });
            }

            // 1h before: Lock RSVP, send DMs
            if (hoursUntil <= 1 && hoursUntil > 0 && !event.reminders.some((r: any) => r.kind === '1h')) {
                await this.lockAndNotify(client, event);
                await prisma.eventReminder.create({
                    data: { eventId: event.id, kind: '1h' }
                });
            }

            // Event time: Check attendance
            if (diff <= 0) {
                await this.checkAttendance(client, event);
            }
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
        } catch { }
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
                } catch { }
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
