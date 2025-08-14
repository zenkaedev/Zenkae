import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { Env } from './env.js';

const commands = [
  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Abre o painel Zenkae (container único)')
    .addBooleanOption((opt) =>
      opt
        .setName('privado')
        .setDescription('Abrir como mensagem efêmera (privada)')
        .setRequired(false),
    )
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(Env.DISCORD_TOKEN);

async function main() {
  if (Env.DEV_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(Env.DISCORD_CLIENT_ID, Env.DEV_GUILD_ID),
      { body: commands },
    );
    console.log('✅ Comandos registrados (guild).');
  } else {
    await rest.put(Routes.applicationCommands(Env.DISCORD_CLIENT_ID), {
      body: commands,
    });
    console.log('✅ Comandos registrados (global).');
  }
}
main().catch((e) => {
  console.error('Falha ao registrar comandos:', e);
  process.exit(1);
});
