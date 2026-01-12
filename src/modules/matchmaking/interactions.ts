// src/modules/matchmaking/interactions.ts

import { InteractionRouter } from '../../infra/router.js';
import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import {
    publishTotem,
    openCreationModal,
    handleCreation,
    handleJoin,
    handleLeave,
    handleManage,
    handleKick,
    handleCancel,
} from './panel.js';

export const matchmakingRouter = new InteractionRouter();

// Dashboard: Publish Totem
matchmakingRouter.button('matchmaking:publishTotem', publishTotem);

// Create Party Flow
matchmakingRouter.button('matchmaking:create', openCreationModal);
matchmakingRouter.modal('matchmaking:modal:create', handleCreation);

// Join/Leave with regex matching
matchmakingRouter.button(/^matchmaking:join:/, async (inter) => {
    if (!inter.isButton()) return;
    const match = inter.customId.match(/^matchmaking:join:(.+):(.+)$/);
    if (!match) return;

    const partyId = match[1];
    const role = match[2];
    await handleJoin(inter as ButtonInteraction, partyId, role);
});

matchmakingRouter.button(/^matchmaking:leave:/, async (inter) => {
    if (!inter.isButton()) return;
    const match = inter.customId.match(/^matchmaking:leave:(.+)$/);
    if (!match) return;

    const partyId = match[1];
    await handleLeave(inter as ButtonInteraction, partyId);
});

// Manage Party
matchmakingRouter.button(/^matchmaking:manage:/, async (inter) => {
    if (!inter.isButton()) return;
    const match = inter.customId.match(/^matchmaking:manage:(.+)$/);
    if (!match) return;

    const partyId = match[1];
    await handleManage(inter as ButtonInteraction, partyId);
});

matchmakingRouter.select(/^matchmaking:kick:/, async (inter) => {
    if (!inter.isStringSelectMenu()) return;
    const match = inter.customId.match(/^matchmaking:kick:(.+)$/);
    if (!match) return;

    const partyId = match[1];
    await handleKick(inter as StringSelectMenuInteraction, partyId);
});

// Cancel Party
matchmakingRouter.button(/^matchmaking:cancel:/, async (inter) => {
    if (!inter.isButton()) return;
    const match = inter.customId.match(/^matchmaking:cancel:(.+)$/);
    if (!match) return;

    const partyId = match[1];
    await handleCancel(inter as ButtonInteraction, partyId);
});
