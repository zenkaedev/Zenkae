// scripts/emojis.sync.ts
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

const token = need('DISCORD_TOKEN');
const guildId = need('DEV_GUILD_ID');
const root = process.cwd();
const ASSETS = path.join(root, 'assets');
const GEN = path.join(root, 'src', 'ui', 'icons.generated.ts');
const PREFIX = readPrefix() ?? 'ic'; // usa assets/icons.manifest.json se existir
const FORCE = process.argv.includes('--force'); // recria emojis existentes
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MAX_SIZE = 256 * 1024; // limite do Discord

const rest = new REST({ version: '10' }).setToken(token);

type MapOut = Record<string, Record<string, { id: string; name: string }>>;

(async () => {
  ensureDir(ASSETS);
  const files = scanAssets(ASSETS);
  if (!files.length) throw new Error('Nenhuma imagem encontrada em /assets');

  const current = (await rest.get(Routes.guildEmojis(guildId))) as any[];
  const byName: Record<string, any> = Object.fromEntries(current.map((e: any) => [e.name, e]));
  const out: MapOut = {};

  for (const f of files) {
    const { group, key, file } = f;
    out[group] ||= {};

    const name = sanitize(`${PREFIX}_${group}_${key}`);
    const existing = byName[name];

    if (existing && !FORCE) {
      out[group][key] = { id: String(existing.id), name };
      console.log(`= ${name} (mantido)`);
      continue;
    }

    if (existing && FORCE) {
      await rest.delete(Routes.guildEmoji(guildId, existing.id)).catch(() => {});
    }

    const stat = fs.statSync(file);
    if (stat.size > MAX_SIZE) {
      console.warn(`! ${name}: ${Math.round(stat.size / 1024)}KB > 256KB (pode falhar)`);
    }

    const image = toDataURI(file);
    const created = (await rest.post(Routes.guildEmojis(guildId), { body: { name, image } })) as any;
    out[group][key] = { id: String(created.id), name };
    console.log(`+ ${name} -> ${created.id}`);
  }

  writeGenerated(out, GEN);
  console.log(`\n✔ Gerado: ${path.relative(root, GEN)}`);
  console.log('Dica: use --force para recriar imagens existentes.');
})().catch((e) => {
  console.error('Falha ao sincronizar emojis:', e);
  process.exit(1);
});

// -------- utils --------
function need(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Env ${k} ausente no .env`);
  return v;
}
function ensureDir(p: string) {
  if (!fs.existsSync(p)) throw new Error(`Pasta não encontrada: ${p}`);
}
function readPrefix(): string | null {
  const mf = path.join(ASSETS, 'icons.manifest.json');
  if (!fs.existsSync(mf)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
    return typeof j.prefix === 'string' ? j.prefix : null;
  } catch { return null; }
}
function scanAssets(base: string) {
  // varre somente 1º nível: assets/<grupo>/*.png
  const out: { group: string; key: string; file: string }[] = [];
  for (const group of fs.readdirSync(base)) {
    const gdir = path.join(base, group);
    if (!fs.statSync(gdir).isDirectory()) continue;
    for (const f of fs.readdirSync(gdir)) {
      const ext = path.extname(f).toLowerCase();
      if (!ALLOWED.has(ext)) continue;
      const key = path.basename(f, ext);
      out.push({ group: slug(group), key: slug(key), file: path.join(gdir, f) });
    }
  }
  return out.sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key));
}
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
}
function sanitize(name: string) {
  const s = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return s.slice(0, 32) || `ic_${Math.random().toString(36).slice(2, 8)}`;
}
function toDataURI(file: string) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}
function writeGenerated(map: MapOut, file: string) {
  const lines: string[] = [];
  lines.push('// AUTO-GERADO por scripts/emojis.sync.ts — não editar.');
  lines.push('export const EMOJI = {');
  for (const [g, entries] of Object.entries(map)) {
    lines.push(`  ${g}: {`);
    for (const [k, v] of Object.entries(entries)) {
      lines.push(`    ${k}: { id: '${v.id}', name: '${v.name}', markup: '<:${v.name}:${v.id}>' },`);
    }
    lines.push('  },');
  }
  lines.push('} as const;');
  lines.push('export type EmojiGroups = keyof typeof EMOJI;');
  lines.push('export type EmojiKey<G extends EmojiGroups> = keyof typeof EMOJI[G];');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}
