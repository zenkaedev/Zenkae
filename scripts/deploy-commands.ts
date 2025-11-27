// scripts/deploy-commands.ts
import 'dotenv/config';
import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { loadCommands } from '../src/commands/index.js';

async function main() {
  const TOKEN = process.env.DISCORD_TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;

  if (!TOKEN) throw new Error('DISCORD_TOKEN ausente no .env');
  if (!CLIENT_ID) throw new Error('CLIENT_ID (ou DISCORD_CLIENT_ID) ausente no .env');

  console.log('🧩 Carregando comandos...');
  const commands: RESTPostAPIApplicationCommandsJSONBody[] = await loadCommands();

  const names = commands.map((c) => c.name).filter(Boolean);
  console.log(`🔎 Encontrados ${commands.length} comandos: ${names.join(', ') || '—'}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  console.log(`🔁 Publicando ${commands.length} comandos (GLOBAL) para app ${CLIENT_ID}...`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

  console.log('✅ Deploy global concluído.');
}

main().catch((err) => {
  console.error('❌ Falha no deploy global:', err);
  process.exit(1);
});
