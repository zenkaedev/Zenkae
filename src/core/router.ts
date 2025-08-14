// src/core/router.ts
// Router central do Zenkae: slash + components + modals, com delegação por prefixo.

import {
  Client,
  Events,
  type Interaction,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import * as Sentry from "@sentry/node";
import type { AppCtx } from "./ctx";

import { handleRecruitSlash } from "../commands/recruit";
import { recruitRouter } from "../routers/recruit";
import { dashboardRouter } from "../routers/dashboard";
import { handleDashboardSlash } from "../commands/dashboard";

export function registerRouter(client: Client, ctx: AppCtx) {
  const log = ctx.logger.child({ scope: "router" });

  client.on(Events.InteractionCreate, async (ix: Interaction) => {
    try {
      // -------- Slash commands --------
      if (ix.isChatInputCommand()) {
        const cmd = ix.commandName;
        log.info(
          { kind: "slash", cmd, gid: ix.guildId, uid: ix.user.id },
          "recv"
        );

        // OBS: Não fazemos defer aqui para não conflitar com os handlers
        // Se seus handlers demorarem >3s para chamar defer, considere mover o defer pra cá e remover dos handlers.
        if (cmd === "dashboard") {
          await handleDashboardSlash(ix as ChatInputCommandInteraction, ctx);
          return;
        }

        if (cmd === "recruit") {
          await handleRecruitSlash(ix as ChatInputCommandInteraction, ctx);
          return;
        }

        if (ix.isRepliable()) {
          await ix.reply({
            content: "Comando não reconhecido.",
            flags: 64,
          });
        }
        return;
      }

      // -------- Components (botões/selects/menus) --------
      if (ix.isMessageComponent()) {
        const mix = ix as MessageComponentInteraction;
        const id = mix.customId ?? "";
        log.info(
          { kind: "component", id, gid: mix.guildId, uid: mix.user.id },
          "recv"
        );

        if (dashboardRouter.match(id)) {
          await dashboardRouter.handle(mix, ctx);
          return;
        }

        if (recruitRouter.match(id)) {
          await recruitRouter.handle(mix, ctx);
          return;
        }

        await safeReply(mix, "Ação não reconhecida.");
        return;
      }

      // -------- Modals --------
      if (ix.isModalSubmit()) {
        const ms = ix as ModalSubmitInteraction;
        const id = ms.customId ?? "";
        log.info(
          { kind: "modal", id, gid: ms.guildId, uid: ms.user.id },
          "recv"
        );

        if (dashboardRouter.match(id)) {
          await dashboardRouter.handle(ms, ctx);
          return;
        }

        if (recruitRouter.match(id)) {
          await recruitRouter.handle(ms, ctx);
          return;
        }

        await safeReply(ms, "Formulário não reconhecido.");
        return;
      }
    } catch (err) {
      log.error({ err }, "Erro ao processar interação");
      try {
        Sentry.captureException?.(err);
      } catch {}
      await replyError(ix);
    }
  });

  log.info("Router registrado");
}

// ---- helpers ----
async function replyError(ix: Interaction) {
  const msg =
    "Deu ruim aqui do nosso lado. Tenta de novo em alguns segundos 😉";
  if (!ix.isRepliable()) return;
  if (ix.deferred || ix.replied) {
    await ix.followUp({ content: msg, flags: 64 }).catch(() => {});
  } else {
    await ix.reply({ content: msg, flags: 64 }).catch(() => {});
  }
}

async function safeReply(
  ix: MessageComponentInteraction | ModalSubmitInteraction,
  content: string
) {
  if (ix.deferred || ix.replied) {
    await ix.followUp({ content, flags: 64 }).catch(() => {});
  } else {
    await ix.reply({ content, flags: 64 }).catch(() => {});
  }
}
