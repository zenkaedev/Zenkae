// scripts/commands.ts
import 'dotenv/config';
import { REST, Routes } from 'discord.js';

// ATENÇÃO (ESM): imports precisam terminar com .js
// scripts/commands.ts
import { data as dashboardCommandData } from '../src/commands/dashboard';
import { recruitCommandData } from '../src/commands/recruit';
import { pollCommandData } from '../src/commands/poll';

const token = mustEnv('DISCORD_TOKEN');
const clientId = mustEnv('DISCORD_CLIENT_ID');
const devGuildId = process.env.DEV_GUILD_ID || '';

const rest = new REST({ version: '10' }).setToken(token);

const COMMANDS = [
  dashboardCommandData,
  recruitCommandData,
  pollCommandData,
];

type Action =
  | 'list-guild'
  | 'list-global'
  | 'publish-guild'
  | 'publish-global'
  | 'wipe-guild'
  | 'wipe-global';

(async () => {
  const action = (process.argv[2] as Action) || 'list-guild';

  try {
    switch (action) {
      case 'list-guild':
        ensureGuild();
        await listGuild();
        break;
      case 'list-global':
        await listGlobal();
        break;
      case 'publish-guild':
        ensureGuild();
        await putGuild(COMMANDS);
        console.log('✔ Comandos (guild) publicados.');
        break;
      case 'publish-global':
        await putGlobal(COMMANDS);
        console.log('✔ Comandos globais publicados.');
        break;
      case 'wipe-guild':
        ensureGuild();
        await putGuild([]);
        console.log('✔ Comandos (guild) LIMPOS.');
        break;
      case 'wipe-global':
        await putGlobal([]);
        console.log('✔ Comandos globais LIMPOS.');
        break;
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (err) {
    console.error('Erro ao operar comandos:', err);
    process.exit(1);
  }
})();

function mustEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env ${key} ausente`);
  return v;
}
function ensureGuild() {
  if (!devGuildId) throw new Error('DEV_GUILD_ID não definido no .env');
}
async function listGuild() {
  const data = (await rest.get(Routes.applicationGuildCommands(clientId, devGuildId))) as any[];
  console.log(`Guild (${devGuildId}) tem ${data.length} comandos:`);
  for (const c of data) console.log('-', c.name, `(${c.id})`);
}
async function listGlobal() {
  const data = (await rest.get(Routes.applicationCommands(clientId))) as any[];
  console.log(`Global tem ${data.length} comandos:`);
  for (const c of data) console.log('-', c.name, `(${c.id})`);
}
async function putGuild(body: any[]) {
  await rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body });
}
async function putGlobal(body: any[]) {
  await rest.put(Routes.applicationCommands(clientId), { body });
}
