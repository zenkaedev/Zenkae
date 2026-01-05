import { InteractionRouter } from '../../infra/router.js';
import { assertStaff } from '../../guards/staff.js';
import { ids } from '../../ui/ids.js';
import { MessageFlags } from 'discord.js';
import { replyV2Notice } from '../../ui/v2.js';

import {
    openNewEventModal,
    handleNewEventSubmit,
    handleRsvpClick,
} from './panel.js';
import { cancelEvent, notifyConfirmed } from './staff.js';

export const eventsRouter = new InteractionRouter();

// New Event
eventsRouter.button(ids.events.new, async (i) => {
    if (!(await assertStaff(i))) return;
    await openNewEventModal(i);
});

eventsRouter.modal('events:new:modal', async (i) => {
    if (!(await assertStaff(i))) return;
    if (!i.deferred && !i.replied) await i.deferReply({ flags: MessageFlags.Ephemeral });
    await handleNewEventSubmit(i);
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
