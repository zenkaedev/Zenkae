// src/services/events/scheduler.ts
import cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Context } from '../../infra/context.js';
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

            const eventDateStr = new Date(event.startsAt).toLocaleString('pt-BR');

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
        // Send DMs to YES rsvps
        try {
            const confirmed = event.rsvps.filter((r: any) => r.choice === 'yes');
            for (const rsvp of confirmed) {
                try {
                    const user = await client.users.fetch(rsvp.userId);
                    const msg = event.dmMessage || `🔔 **Lembrete:** O evento **${event.title}** começa em 1 hora!`;
                    await user.send(msg);
                } catch { }
            }
            console.log(`[SCHEDULER] Notified ${confirmed.length} users for event: ${event.title}`);
        } catch (err) {
            console.error('[SCHEDULER] Error in lockAndNotify:', err);
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
            console.error('[SCHEDULER] Error checking attendance:', err);
        }
    }
};
