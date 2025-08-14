import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { renderDashboard } from '../ui/container';
import { replyV2, replyV2Notice } from '../ui/v2';

export const data = new SlashCommandBuilder()
  .setName('dashboard')
  .setDescription('Abre o dashboard do Zenkae')
  .addBooleanOption((opt) =>
    opt.setName('privado')
      .setDescription('Responde só para você (efêmero)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await replyV2Notice(interaction, 'Use este comando dentro de um servidor.', true);
    return;
  }

  const privado = interaction.options.getBoolean('privado') ?? false;
  const base = await renderDashboard({ tab: 'home', guildId: interaction.guildId ?? undefined });

  // Responde em Components V2; se privado=true adiciona Ephemeral
  await replyV2(interaction, base, privado);
}

export default { data, execute };
