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
// recruitRouter (HTTP) não é um router de interações Discord — não importar aqui
import { dashboardRouter } from "../routers/dashboard";
import dashboard from "../commands/dashboard";

// Poll: slash + botões + modal
import { executePoll } from "../commands/poll";
import { handlePollButton, handleCreatePollSubmit } from "../ui/poll/panel";
import { pollIds } from "../ui/poll/ids";

export function registerRouter(client: Client, _ctx: AppCtx) {
  const log = (_ctx.logger ?? console) as any;

  client.on(Events.InteractionCreate, async (ix: Interaction) => {
    try {
      /* ----------------------------- Slash ----------------------------- */
      if (ix.isChatInputCommand()) {
        const cmd = ix.commandName;
        log.info?.({ kind: "slash", cmd, gid: ix.guildId, uid: ix.user.id }, "recv");

        // OBS: não fazemos defer aqui para não conflitar com os handlers
        if (cmd === "dashboard") {
          await dashboard.execute(ix as ChatInputCommandInteraction);
          return;
        }

        if (cmd === "recruit") {
          await handleRecruitSlash(ix as ChatInputCommandInteraction, _ctx);
          return;
        }

        if (cmd === "poll") {
          await executePoll(ix as ChatInputCommandInteraction);
          return;
        }

        if (ix.isRepliable()) {
          await ix.reply({ content: "Comando não reconhecido.", flags: 64 });
        }
        return;
      }

      /* -------------------------- Components -------------------------- */
      if (ix.isMessageComponent()) {
        const mix = ix as MessageComponentInteraction;
        const id = mix.customId ?? "";
        log.info?.({ kind: "component", id, gid: mix.guildId, uid: mix.user.id }, "recv");

        // Enquete (vote/result/close)
        if (id.startsWith("poll:")) {
          try {
            await handlePollButton(mix as any);
          } catch {
            await safeReply(mix, "❌ Erro ao processar ação da enquete.");
          }
          return;
        }

        // Dashboard V2
        if (dashboardRouter.match(id)) {
          await dashboardRouter.handle(mix, _ctx);
          return;
        }

        await safeReply(mix, "Ação não reconhecida.");
        return;
      }

      /* ----------------------------- Modals ---------------------------- */
      if (ix.isModalSubmit()) {
        const ms = ix as ModalSubmitInteraction;
        const id = ms.customId ?? "";
        log.info?.({ kind: "modal", id, gid: ms.guildId, uid: ms.user.id }, "recv");

        // Modal de criação de enquete
        if (id === pollIds.createModal) {
          try {
            await handleCreatePollSubmit(ms as any);
          } catch {
            await safeReply(ms as any, "❌ Erro ao processar formulário de enquete.");
          }
          return;
        }

        if (dashboardRouter.match(id)) {
          await dashboardRouter.handle(ms, _ctx);
          return;
        }

        await safeReply(ms, "Formulário não reconhecido.");
        return;
      }
    } catch (err) {
      log.error?.({ err }, "Erro ao processar interação");
      try {
        Sentry.captureException?.(err);
      } catch {}
      await replyError(ix);
    }
  });

  log.info?.("Router registrado");
}

/* ------------------------------ helpers ------------------------------ */
async function replyError(ix: Interaction) {
  const msg = "Deu ruim aqui do nosso lado. Tenta de novo em alguns segundos 😉";
  if (!("isRepliable" in ix) || !ix.isRepliable()) return;
  if ((ix as any).deferred || (ix as any).replied) {
    await (ix as any).followUp({ content: msg, flags: 64 }).catch(() => {});
  } else {
    await (ix as any).reply({ content: msg, flags: 64 }).catch(() => {});
  }
}

async function safeReply(ix: MessageComponentInteraction | ModalSubmitInteraction, content: string) {
  if ((ix as any).deferred || (ix as any).replied) {
    await (ix as any).followUp({ content, flags: 64 }).catch(() => {});
  } else {
    await (ix as any).reply({ content, flags: 64 }).catch(() => {});
  }
}
