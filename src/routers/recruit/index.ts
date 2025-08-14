import type {
  Interaction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import type { AppCtx } from "../../core/ctx";
import { GuildConfigRepo } from "../../db/repos/guildConfig.repo";
import { NO_MENTIONS } from "../../core/djs-helpers";
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { z } from "zod";

const IDs = {
  APPLY: "recruit:apply",
  CLASS_SELECT: "recruit:class",
  CLASS_NEXT: "recruit:classNext",
  MODAL: "recruit:applyModal",
  FIELD_NICK: "nick",
} as const;

export const recruitRouter = {
  match(id: string) {
    return id.startsWith("recruit:");
  },

  async handle(
    ix: Interaction | MessageComponentInteraction | ModalSubmitInteraction,
    ctx: AppCtx
  ) {
    const repo = new GuildConfigRepo(
      (ctx.repos.guildConfig as any).prisma ?? (ctx as any).prisma
    );

    // 1) Botão "Candidatar-se"
    if (ix.isButton() && ix.customId === IDs.APPLY) {
      await ix.deferReply({ flags: MessageFlags.Ephemeral });
      const cfg = await repo.getFormConfig(ix.guildId!);

      const menu = new StringSelectMenuBuilder()
        .setCustomId(IDs.CLASS_SELECT)
        .setPlaceholder("Selecione sua classe");

      for (const opt of cfg.classOptions) {
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(opt.label)
            .setValue(opt.value)
        );
      }

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        menu
      );

      await ix.editReply({
        content: "Escolha sua classe:",
        components: [row],
        allowedMentions: NO_MENTIONS,
      });
      return;
    }

    // 2) Select da classe
    if (ix.isStringSelectMenu() && ix.customId === IDs.CLASS_SELECT) {
      await ix.deferReply({ flags: MessageFlags.Ephemeral });
      const chosen = ix.values[0];

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDs.CLASS_NEXT}:${chosen}`)
          .setLabel("Continuar")
          .setStyle(ButtonStyle.Primary)
      );

      await ix.editReply({
        content: `Classe selecionada: **${chosen}**. Clique em Continuar.`,
        components: [row],
        allowedMentions: NO_MENTIONS,
      });
      return;
    }

    // 3) Botão "Continuar" → ABRE MODAL (sem defer antes)
    if (ix.isButton() && ix.customId.startsWith(IDs.CLASS_NEXT)) {
      const chosen = ix.customId.split(":")[1] ?? "";
      const cfg = await repo.getFormConfig(ix.guildId!);

      const modal = new ModalBuilder()
        .setCustomId(`${IDs.MODAL}:${chosen}`)
        .setTitle("Candidatura");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(IDs.FIELD_NICK)
            .setLabel("Seu nick no servidor")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      for (const q of (cfg.questions ?? []).slice(0, 4)) {
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId(q.id)
              .setLabel(q.label)
              .setStyle(
                q.type === "paragraph"
                  ? TextInputStyle.Paragraph
                  : TextInputStyle.Short
              )
              .setRequired(!!q.required)
          )
        );
      }

      await ix.showModal(modal);
      return;
    }

    // 4) Submit do modal
    if (ix.isModalSubmit() && ix.customId.startsWith(IDs.MODAL)) {
      await ix.deferReply({ flags: MessageFlags.Ephemeral });

      const chosen = ix.customId.split(":")[1] ?? "";
      const dynamicKeys = Array.from(ix.fields.fields.keys()).filter(
        (k) => k !== IDs.FIELD_NICK
      );
      const dynShape: Record<string, z.ZodTypeAny> = {};
      for (const k of dynamicKeys) dynShape[k] = z.string().min(1);

      const Schema = z.object({
        [IDs.FIELD_NICK]: z.string().min(2).max(32),
        ...dynShape,
      });

      const answers = Schema.parse(
        Object.fromEntries(
          Array.from(ix.fields.fields.entries()).map(([k, v]) => [k, v.value])
        ) as any
      );

      await ctx.repos.application.create({
        userId: ix.user.id,
        guildId: ix.guildId!,
        answers: JSON.stringify({ class: chosen, ...answers }),
      });

      await ix.editReply({
        content: "✅ Recebemos sua candidatura!",
        allowedMentions: NO_MENTIONS,
      });
      return;
    }
  },
};
