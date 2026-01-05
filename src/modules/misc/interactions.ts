import { InteractionRouter } from '../../infra/router.js';
import { assertStaff } from '../../guards/staff.js';
import { ids } from '../../ui/ids.js';
import { MessageFlags } from 'discord.js';

// Activity
import { publishActivityPanel, handleActivityCheck } from '../activity/panel.js';

// Poll
import { handlePollButton, handleCreatePollSubmit } from '../../ui/poll/panel.js';
import { pollIds } from '../../ui/poll/ids.js';

export const miscRouter = new InteractionRouter();

/* ==================== Activity ==================== */
miscRouter.button(ids.activity.publish, async (i) => {
    if (!(await assertStaff(i))) return;
    await publishActivityPanel(i);
});

miscRouter.button(ids.activity.check, async (i) => {
    await handleActivityCheck(i);
});

/* ==================== Admin ==================== */
miscRouter.button(ids.admin.clean, async (i) => {
    // @ts-ignore
    if (i.message) await i.message.edit({ components: [] });
    await i.deferUpdate();
});

/* ==================== Poll ==================== */
miscRouter.button(new RegExp('^poll:'), async (i) => {
    // Poll handles its own errors usually, but we wrap in router anyway
    await handlePollButton(i as any);
});

miscRouter.modal(pollIds.createModal, async (i) => {
    if (!i.deferred && !i.replied) await i.deferReply({ flags: MessageFlags.Ephemeral });
    await handleCreatePollSubmit(i as any);
});
