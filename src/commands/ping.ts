// src/commands/ping.ts
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Mostra latência (API e WebSocket).')
  .setDMPermission(false); // desativa em DM; remova se quiser permitir

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const start = Date.now();

    // Resposta inicial (efêmera)
    await interaction.reply({ content: '⏱️ Calculando...', ephemeral: true });

    const apiLatency = Date.now() - start;
    const ws = Math.round(interaction.client.ws.ping ?? 0);

    await interaction.editReply(
      `🏓 **Pong!**\n• API: ~${apiLatency}ms\n• WS: ${ws}ms`,
    );
  } catch (err) {
    // fallback silencioso para não quebrar a UX
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ Ocorreu um erro ao medir a latência.');
      } else {
        await interaction.reply({
          content: '❌ Ocorreu um erro ao medir a latência.',
          ephemeral: true,
        });
      }
    } catch {}
    // Logue no seu logger/Sentry se desejar
    // console.error('ping command error:', err);
  }
}

export default { data, execute };
