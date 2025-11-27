// scripts/commands.ts
import 'dotenv/config';
import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { loadCommands } from '../src/commands/index.js';

type Action =
  | 'list-guild'
  | 'list-global'
  | 'publish-guild'
  | 'publish-global'
  | 'wipe-guild'
  | 'wipe-global';

const TOKEN = mustEnv('DISCORD_TOKEN');
const CLIENT_ID = process.env.CLIENT_ID || mustEnv('DISCORD_CLIENT_ID'); // fallback legado
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  const action = (process.argv[2] as Action) || 'list-global';

  try {
    switch (action) {
      case 'list-guild': {
        const guildId = requireGuildId();
        await listGuild(guildId);
        break;
      }
      case 'list-global': {
        await listGlobal();
        break;
      }
      case 'publish-guild': {
        const guildId = requireGuildId();
        const cmds = await getCommands();
        await putGuild(cmds, guildId);
        console.log('✔ Comandos (guild) publicados.');
        break;
      }
      case 'publish-global': {
        const cmds = await getCommands();
        await putGlobal(cmds);
        console.log('✔ Comandos globais publicados.');
        break;
      }
      case 'wipe-guild': {
        const guildId = requireGuildId();
        await putGuild([], guildId);
        console.log('✔ Comandos (guild) LIMPOS.');
        break;
      }
      case 'wipe-global': {
        await putGlobal([]);
        console.log('✔ Comandos globais LIMPOS.');
        break;
      }
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (err) {
    console.error('❌ Erro ao operar comandos:', err);
    process.exit(1);
  }
})();

// ---------- helpers ----------
function mustEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env ${key} ausente`);
  return v;
}

function requireGuildId(): string {
  const id = process.env.DEV_GUILD_ID;
  if (!id) throw new Error('DEV_GUILD_ID não definido no .env');
  return id;
}

async function getCommands(): Promise<RESTPostAPIApplicationCommandsJSONBody[]> {
  console.log('🧩 Carregando comandos...');
  const commands = await loadCommands();
  const names = commands.map((c) => c.name).filter(Boolean);
  console.log(`🔎 Encontrados ${commands.length}: ${names.join(', ') || '—'}`);
  return commands;
}

async function listGuild(guildId: string) {
  const data = (await rest.get(Routes.applicationGuildCommands(CLIENT_ID, guildId))) as Array<{
    name: string;
    id: string;
  }>;
  console.log(`📋 Guild (${guildId}) tem ${data.length} comandos:`);
  for (const c of data) console.log('-', c.name, `(${c.id})`);
}

async function listGlobal() {
  const data = (await rest.get(Routes.applicationCommands(CLIENT_ID))) as Array<{
    name: string;
    id: string;
  }>;
  console.log(`🌍 Global tem ${data.length} comandos:`);
  for (const c of data) console.log('-', c.name, `(${c.id})`);
}

async function putGuild(body: RESTPostAPIApplicationCommandsJSONBody[], guildId: string) {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
}

async function putGlobal(body: RESTPostAPIApplicationCommandsJSONBody[]) {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
}
