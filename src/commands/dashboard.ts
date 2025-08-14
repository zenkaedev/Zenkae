import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { AppCtx } from "../core/ctx";
import { renderDashHome } from "../ui/dashboard/home";

/**
 * /dashboard
 * Estratégia anti-10062:
 * - NÃO usa deferReply (responde direto em <3s).
 * - Se por algum motivo já estiver deferido/replied, cai para editReply.
 */
export async function handleDashboardSlash(ix: ChatInputCommandInteraction, ctx: AppCtx) {
  const log = ctx.logger.child({ scope: "dashboard" });

  try {
    const view = renderDashHome();

    if (ix.deferred || ix.replied) {
      await ix.editReply(view);
    } else {
      await ix.reply({ ...view, flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    log.error({ err }, "Erro no /dashboard");

    // fallback seguro
    try {
      if (ix.deferred || ix.replied) {
        await ix.editReply({ content: "❌ Deu ruim ao abrir o dashboard. Tenta de novo." });
      } else if (ix.isRepliable()) {
        await ix.reply({ content: "❌ Deu ruim ao abrir o dashboard. Tenta de novo.", flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
}
