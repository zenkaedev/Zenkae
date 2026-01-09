import { InteractionRouter } from '../../infra/router.js';
import { renderEconomyHome, renderItemsList, renderEventsList, renderStats } from './panel.js';
import { openCurrencyModal, handleCurrencySubmit } from './currency.js';
import {
    openNewItemModal,
    handleNewItemSubmit,
    renderItemDetails,
    handleStartAuctionFromPanel,
    handleDeleteItem
} from './items.js';
import {
    openNewEventModal,
    handleNewEventSubmit,
    renderEventDetails,
    handleCancelEvent
} from './events.js';
import { MessageFlags } from 'discord.js';

export const economyRouter = new InteractionRouter();

// Home
economyRouter.button('economy:home', async (interaction) => {
    if (!interaction.isButton()) return;
    const payload = await renderEconomyHome(interaction.guildId!);
    await interaction.update(payload);
});

// Currency
economyRouter.button('economy:currency', openCurrencyModal);
economyRouter.modal('economy:currency:modal', handleCurrencySubmit);

// Items
economyRouter.button('economy:items', async (interaction) => {
    if (!interaction.isButton()) return;
    const payload = await renderItemsList(interaction.guildId!);
    await interaction.update(payload);
});

economyRouter.button('economy:items:new', openNewItemModal);
economyRouter.modal('economy:items:new:modal', handleNewItemSubmit);

economyRouter.button(/^economy:item:([^:]+)$/, async (interaction) => {
    if (!interaction.isButton()) return;
    const match = interaction.customId.match(/^economy:item:([^:]+)$/);
    if (!match) return;
    const itemId = match[1];
    await renderItemDetails(interaction, itemId);
});

economyRouter.button(/^economy:item:([^:]+):auction$/, async (interaction) => {
    if (!interaction.isButton()) return;
    const match = interaction.customId.match(/^economy:item:([^:]+):auction$/);
    if (!match) return;
    const itemId = match[1];
    await handleStartAuctionFromPanel(interaction, itemId);
});

economyRouter.button(/^economy:item:([^:]+):delete$/, async (interaction) => {
    if (!interaction.isButton()) return;
    const match = interaction.customId.match(/^economy:item:([^:]+):delete$/);
    if (!match) return;
    const itemId = match[1];
    await handleDeleteItem(interaction, itemId);
});

// Auction Bid
economyRouter.button(/^auction_bid_/, async (interaction) => {
    if (!interaction.isButton()) return;

    const match = interaction.customId.match(/^auction_bid_(.+)$/);
    if (!match) return;

    const itemId = match[1];

    const { bidManager: bidService } = await import('../../services/auction/bid-manager.js');
    const result = await bidService.placeBid(interaction.guildId!, interaction.user.id, itemId);

    const emoji = result.success ? '✅' : '❌';
    await interaction.reply({
        content: `${emoji} ${result.message}`,
        flags: 64
    });
});

// Events
economyRouter.button('economy:events', async (interaction) => {
    if (!interaction.isButton()) return;
    const payload = await renderEventsList(interaction.guildId!);
    await interaction.update(payload);
});

economyRouter.button('economy:events:new', openNewEventModal);
economyRouter.modal('economy:events:new:modal', handleNewEventSubmit);

economyRouter.button(/^economy:event:([^:]+)$/, async (interaction) => {
    if (!interaction.isButton()) return;
    const match = interaction.customId.match(/^economy:event:([^:]+)$/);
    if (!match) return;
    const eventId = match[1];
    await renderEventDetails(interaction, eventId);
});

economyRouter.button(/^economy:event:([^:]+):cancel$/, async (interaction) => {
    if (!interaction.isButton()) return;
    const match = interaction.customId.match(/^economy:event:([^:]+):cancel$/);
    if (!match) return;
    const eventId = match[1];
    await handleCancelEvent(interaction, eventId);
});

// Stats
economyRouter.button('economy:stats', async (interaction) => {
    if (!interaction.isButton()) return;
    const payload = await renderStats(interaction.guildId!);
    await interaction.update(payload);
});
