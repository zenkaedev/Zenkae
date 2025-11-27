// scripts/clear-guild-commands.ts
import 'dotenv/config';
import { REST, Routes } from 'discord.js';

async function main() {
  const TOKEN = process.env.DISCORD_TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  const GUILD_ID = process.env.DEV_GUILD_ID;

  if (!TOKEN) throw new Error('DISCORD_TOKEN ausente no .env');
  if (!CLIENT_ID) throw new Error('CLIENT_ID (ou DISCORD_CLIENT_ID) ausente no .env');
  if (!GUILD_ID) throw new Error('DEV_GUILD_ID ausente no .env');

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  // (Opcional) listar comandos atuais antes de limpar
  try {
    const current = (await rest.get(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    )) as Array<{ name: string }>;

    console.log(`📋 Comandos atuais na guild ${GUILD_ID}: ${current.length}`);
    if (current.length) {
      console.log('   ', current.map((c) => c.name).join(', '));
    }
  } catch {
    console.warn('⚠️ Não foi possível listar comandos atuais (seguindo para limpeza).');
  }

  console.log(`🧹 Limpando comandos da guild ${GUILD_ID}...`);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
  console.log('✅ Guild commands limpos.');
}

main().catch((err) => {
  console.error('❌ Falha ao limpar guild commands:', err);
  process.exit(1);
});
