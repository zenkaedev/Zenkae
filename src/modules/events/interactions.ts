import { InteractionRouter } from '../../infra/router.js';
import { assertStaff } from '../../guards/staff.js';
import { ids } from '../../ui/ids.js';
import { MessageFlags } from 'discord.js';
import { replyV2Notice } from '../../ui/v2.js';

import {
    openNewEventModal,
    handleDraftAction,
    handleRsvpClick,
} from './panel.js';
import { cancelEvent, notifyConfirmed } from './staff.js';
import { eventsStore } from './store.js';

export const eventsRouter = new InteractionRouter();

// New Event
eventsRouter.button(ids.events.new, async (i) => {
    if (!(await assertStaff(i))) return;
    await openNewEventModal(i);
});

// Draft Handlers (Edit, Toggle, Publish)
eventsRouter.button(new RegExp('^events:draft:'), async (i) => {
    if (!(await assertStaff(i))) return;
    await handleDraftAction(i);
});

eventsRouter.modal(new RegExp('^events:draft:submit:'), async (i) => {
    if (!(await assertStaff(i))) return;
    // Modals don't need defer if we update immediately, but let's see logic inside
    await handleDraftAction(i);
});

// RSVP
eventsRouter.button(new RegExp('^events:rsvp:'), async (i) => {
    // Regex matching means we need to manually parse in existing logic or reuse parseRsvp
    // ids.events.parseRsvp(i.customId)
    const parsed = ids.events.parseRsvp(i.customId);
    if (!parsed || !parsed.eventId) {
        await replyV2Notice(i, '❌ RSVP inválido.', true);
        return;
    }
    await handleRsvpClick(i, parsed.choice, parsed.eventId);
});

// Generic RSVP (Public)
eventsRouter.button(/^event_rsvp_(yes|no)_/, async (interaction) => {
    if (!interaction.isButton()) return;

    const match = interaction.customId.match(/^event_rsvp_(yes|no)_(.+)$/);
    if (!match) return;

    const response = match[1].toUpperCase() as 'YES' | 'NO';
    const eventId = match[2];

    const { rsvpChoiceToEnum } = await import('../../services/events/rsvp.js');
    await eventsStore.rsvp(eventId, interaction.guildId!, interaction.user.id, rsvpChoiceToEnum(response));

    const emoji = response === 'YES' ? '✅' : '❌';
    await interaction.reply({
        content: `${emoji} Resposta registrada!`,
        flags: 64
    });
});

// Notify
eventsRouter.button(new RegExp('^events:notify:'), async (i) => {
    if (!(await assertStaff(i))) return;
    const n = ids.events.parseNotify(i.customId);
    if (!n || !n.eventId) {
        await replyV2Notice(i, '❌ Evento inválido.', true);
        return;
    }
    await notifyConfirmed(i, n.eventId);
});

// Cancel
eventsRouter.button(new RegExp('^events:cancel:'), async (i) => {
    if (!(await assertStaff(i))) return;
    const c = ids.events.parseCancel(i.customId);
    if (!c || !c.eventId) {
        await replyV2Notice(i, '❌ Evento inválido.', true);
        return;
    }
    await cancelEvent(i, c.eventId);
});
