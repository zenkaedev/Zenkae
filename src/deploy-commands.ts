// src/deploy-commands.ts
// Registro dos slash commands (/recruit setup|publish)
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.DISCORD_CLIENT_ID!;
const devGuildId = process.env.DEV_GUILD_ID || '';

if (!token || !clientId) {
  console.error('DISCORD_TOKEN e/ou DISCORD_CLIENT_ID ausentes no .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('recruit')
    .setDescription('Gerenciar recrutamento')
    .addSubcommand((sc) =>
      sc.setName('setup').setDescription('Inicia/garante a configuração básica do recrutamento'),
    )
    .addSubcommand((sc) =>
      sc.setName('publish').setDescription('Publica o painel público de recrutamento'),
    )
    .toJSON(),
];

(async () => {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (devGuildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body: commands });
      console.log('✔ Comandos de DEV (guild) registrados.');
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✔ Comandos globais registrados.');
    }
  } catch (err) {
    console.error('Falha ao registrar comandos:', err);
    process.exit(1);
  }
})();
