// src/listeners/interactions.ts
import { Events, type Client, MessageFlags } from 'discord.js';
import { InteractionRouter } from '../infra/router.js';
import { handleError } from '../infra/errors.js';
import { logger } from '../infra/logger.js';
import { ids } from '../ui/ids.js';
import { renderDashboard, type DashTab } from '../container.js';
import { safeUpdate } from '../ui/v2.js';

// Sub-routers
import { recruitRouter } from '../modules/recruit/interactions.js';
import { eventsRouter } from '../modules/events/interactions.js';
import { miscRouter } from '../modules/misc/interactions.js';

// Legacy / Command handlers
import { execute as executeEvents } from '../commands/events.js';
import { execute as executeBotProfile } from '../commands/botProfile.js';
import { execute as executePoll } from '../commands/poll.js';

export function registerInteractionRouter(client: Client) {
  const mainRouter = new InteractionRouter();

  // Merge sub-modules
  mainRouter.merge(recruitRouter);
  mainRouter.merge(eventsRouter);
  mainRouter.merge(miscRouter);

  // Register generic dashboard navigation (that sits on root)
  mainRouter.button(new RegExp('^dash:'), async (interaction) => {
    if (!ids.dash.is(interaction.customId)) return;

    const parsed = ids.dash.parse(interaction.customId);
    if (!parsed) return;

    const base = await renderDashboard({
      tab: parsed.tab as DashTab,
      guildId: interaction.guildId ?? undefined,
    });
    await safeUpdate(interaction, base);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // 1. Log action
      if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
        logger.info({
          type: 'interaction',
          id: interaction.customId,
          user: interaction.user.tag
        }, 'Interaction Received');
      }

      // 2. Commands (Not routed via customId)
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName;
        if (cmd === 'dashboard') {
          const privado = interaction.options.getBoolean('privado') ?? false;
          const base = await renderDashboard({ tab: 'home', guildId: interaction.guildId ?? undefined });
          await interaction.reply({
            ...base,
            flags: (base.flags ?? 0) | (privado ? MessageFlags.Ephemeral : 0),
          });
          return;
        }
        if (cmd === 'evento') return await executeEvents(interaction);
        if (cmd === 'bot-profile') return await executeBotProfile(interaction);
        if (cmd === 'poll') return await executePoll(interaction as any);
      }

      // 3. Router
      const handled = await mainRouter.handle(interaction);
      if (!handled && (interaction.isButton() || interaction.isModalSubmit())) {
        logger.warn({ id: interaction.customId }, 'Interaction not matched by any route');
      }

    } catch (err) {
      if (interaction.isRepliable()) {
        await handleError(interaction, err);
      } else {
        logger.error({ err }, 'Error in non-repliable interaction');
      }
    }
  });
}
