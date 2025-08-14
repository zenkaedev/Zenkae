import type { ChatInputCommandInteraction } from "discord.js";
import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { AppCtx } from "../core/ctx";
import { GuildConfigRepo } from "../db/repos/guildConfig.repo";

/**
 * /recruit setup|publish
 * - setup: placeholder (confirma painel)
 * - publish: publica painel público "Candidatar-se" no canal atual
 */
export async function handleRecruitSlash(ix: ChatInputCommandInteraction, ctx: AppCtx) {
  const log = ctx.logger.child({ scope: "recruit" });

  // Defer EFÊMERO logo no início para evitar 10062
  await ix.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const sub = ix.options.getSubcommand(true); // "setup" ou "publish"

    if (sub === "setup") {
      await ix.editReply({
        content: "🔧 Tela de setup (placeholder). Em breve, edição persistente pelo dashboard.",
      });
      return;
    }

    if (sub === "publish") {
      const repo = new GuildConfigRepo(
        (ctx.repos.guildConfig as any).prisma ?? (ctx as any).prisma
      );
      const cfg = await repo.getFormConfig(ix.guildId!);

      const embed = new EmbedBuilder()
        .setTitle("Recrutamento")
        .setDescription(
          [
            cfg?.classOptions?.length
              ? `Classes disponíveis: ${cfg.classOptions.map((c) => `\`${c.label}\``).join(", ")}`
              : "Use o dashboard para definir as classes disponíveis.",
            "",
            "Clique no botão abaixo para iniciar sua candidatura.",
          ].join("\n"),
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("recruit:apply")
          .setLabel("Candidatar-se")
          .setStyle(ButtonStyle.Primary),
      );

      // ---- Type guard para canais que suportam send() ----
      const ch = ix.channel;
      if (!ch || typeof (ch as any).send !== "function") {
        await ix.editReply({
          content: "⚠️ Não consegui publicar aqui. Execute o comando num canal de texto do servidor.",
        });
        return;
      }

      await (ch as any).send({ embeds: [embed], components: [row] });
      await ix.editReply({ content: "✅ Painel de recrutamento publicado no canal atual." });
      return;
    }

    await ix.editReply({ content: "Subcomando não reconhecido." });
  } catch (err: any) {
    log.error({ err }, "Erro no /recruit");
    await ix.editReply({ content: "❌ Não foi possível processar o comando." }).catch(() => {});
  }
}
