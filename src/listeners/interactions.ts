// src/listeners/interactions.ts
import { Events, type Client, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { InteractionRouter } from '../infra/router.js';
import { handleError } from '../infra/errors.js';
import { logger } from '../infra/logger.js';
import { ids } from '../ui/ids.js';
import { renderDashboard, type DashTab } from '../container.js';
import { safeUpdate } from '../ui/v2.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Sub-routers
import { recruitRouter } from '../modules/recruit/interactions.js';
import { eventsRouter } from '../modules/events/interactions.js';
import { miscRouter } from '../modules/misc/interactions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dinamically load all command modules
const commandsPath = path.join(__dirname, '..', 'commands');
const commandModules = new Map<string, any>();

async function loadAllCommands() {
  logger.info({ commandsPath, dirname: __dirname }, 'Loading commands from path');

  // Check if directory exists
  if (!fs.existsSync(commandsPath)) {
    logger.error({ commandsPath }, 'Commands directory does not exist!');
    return;
  }

  const files = fs.readdirSync(commandsPath)
    .filter(f => (f.endsWith('.js') || f.endsWith('.ts')) && f !== 'index.js' && f !== 'index.ts' && !f.startsWith('_'));

  logger.info({ files, count: files.length }, 'Found command files');

  for (const file of files) {
    const filePath = pathToFileURL(path.join(commandsPath, file)).href;
    try {
      const module = await import(filePath);
      if (module.data && module.execute) {
        const cmdName = module.data.name;
        commandModules.set(cmdName, module);
        logger.info({ command: cmdName }, 'Command loaded');
      } else {
        logger.warn({ file }, 'File missing data or execute export');
      }
    } catch (err) {
      logger.error({ file, err }, 'Failed to load command');
    }
  }
  logger.info({ count: commandModules.size }, 'All commands loaded');
}

export async function registerInteractionRouter(client: Client) {
  // Load all commands first
  await loadAllCommands();

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

        // Try dynamic command loading first
        const commandModule = commandModules.get(cmd);
        if (commandModule && commandModule.execute) {
          logger.info({ command: cmd, user: interaction.user.tag }, 'Executing command');
          await commandModule.execute(interaction as ChatInputCommandInteraction);
          return;
        }

        // Fallback for dashboard (special case)
        if (cmd === 'dashboard') {
          const privado = interaction.options.getBoolean('privado') ?? false;
          const base = await renderDashboard({ tab: 'home', guildId: interaction.guildId ?? undefined });
          await interaction.reply({
            ...base,
            flags: (base.flags ?? 0) | (privado ? MessageFlags.Ephemeral : 0),
          });
          return;
        }

        // Command not found
        logger.warn({ command: cmd }, 'Command not found');
        await interaction.reply({
          content: '❌ Comando não encontrado.',
          flags: MessageFlags.Ephemeral
        });
        return;
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
