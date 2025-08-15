// src/commands/recruit.ts
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { AppCtx } from "../core/ctx";
import { buildClassStep } from "../ui/recruit/form";
import { loadFormConfig } from "../services/recruit.config"; // CORREÇÃO: A função se chama loadFormConfig

// Exporta a definição do comando para o script de deploy
export const recruitCommandData = new SlashCommandBuilder()
  .setName("recruit")
  .setDescription("Inicia seu processo de candidatura para se juntar ao time.");

// Exporta o handler da interação
export async function handleRecruitSlash(ix: ChatInputCommandInteraction, ctx: AppCtx) { // CORREÇÃO: ctx é necessário para loadFormConfig
  const log = ctx.logger.child({ scope: "recruit-slash" });

  // Garante que o comando está sendo usado em um servidor
  if (!ix.guildId) {
    await ix.reply({
      content: "Use este comando dentro de um servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // 1. Carrega a configuração do formulário usando o serviço
    const cfg = await loadFormConfig(ctx, ix.guildId);

    // 2. Constrói a primeira etapa da UI (seleção de classe)
    const payload = buildClassStep(cfg.classOptions);

    // 3. Responde ao usuário de forma efêmera com a UI
    await ix.reply({
      ...payload,
      flags: MessageFlags.Ephemeral, // Resposta visível apenas para o usuário
    });
  } catch (err) {
    log.error({ err }, "Erro ao iniciar o processo de recrutamento");
    if (ix.replied || ix.deferred) {
      await ix.followUp({ content: "❌ Ops! Não consegui iniciar o formulário. Tente novamente.", flags: MessageFlags.Ephemeral });
    } else {
      await ix.reply({ content: "❌ Ops! Não consegui iniciar o formulário. Tente novamente.", flags: MessageFlags.Ephemeral });
    }
  }
}