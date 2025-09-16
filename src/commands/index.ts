// src/commands/index.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(): Promise<RESTPostAPIApplicationCommandsJSONBody[]> {
  const files = fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((f) => !f.startsWith('_')) 
    .filter((f) => f !== 'index.ts' && f !== 'index.js')
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  const payload: RESTPostAPIApplicationCommandsJSONBody[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const url = pathToFileURL(path.join(__dirname, file)).href;

    let mod: Record<string, unknown>;
    try {
      mod = (await import(url)) as Record<string, unknown>;
    } catch (err) {
      console.error(`❌ Falha ao importar "${file}":`, err);
      continue;
    }

    // Coletores possíveis:
    // 1) default.data.toJSON()
    const maybeDefault = (mod as any)?.default;
    if (maybeDefault?.data?.toJSON instanceof Function) {
      const json = maybeDefault.data.toJSON() as RESTPostAPIApplicationCommandsJSONBody;
      if (json?.name && !seen.has(json.name)) {
        payload.push(json);
        seen.add(json.name);
      }
    }

    // 2) data.toJSON()
    if ((mod as any)?.data?.toJSON instanceof Function) {
      const json = (mod as any).data.toJSON() as RESTPostAPIApplicationCommandsJSONBody;
      if (json?.name && !seen.has(json.name)) {
        payload.push(json);
        seen.add(json.name);
      }
    }

    // 3) Qualquer export que possua .toJSON() (ex.: recruitCommandData, pollCommandData, eventsCommandData)
    for (const value of Object.values(mod)) {
      // array de builders
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v?.toJSON instanceof Function) {
            const json = v.toJSON() as RESTPostAPIApplicationCommandsJSONBody;
            if (json?.name && !seen.has(json.name)) {
              payload.push(json); seen.add(json.name);
            }
          }
        }
        continue;
      }
      // objeto simples com toJSON()
      if (value && (value as any).toJSON instanceof Function) {
        const json = (value as any).toJSON() as RESTPostAPIApplicationCommandsJSONBody;
        if (json?.name && !seen.has(json.name)) {
          payload.push(json); seen.add(json.name);
        }
      }
      // objeto com .data.toJSON()
      if (value && (value as any).data?.toJSON instanceof Function) {
        const json = (value as any).data.toJSON() as RESTPostAPIApplicationCommandsJSONBody;
        if (json?.name && !seen.has(json.name)) {
          payload.push(json); seen.add(json.name);
        }
      }
    }
  }

  if (!payload.length) {
    console.warn('⚠️ Nenhum comando encontrado para publicar.');
  } else {
    console.log(`🧩 Comandos carregados: ${payload.length}`);
  }
  return payload;
}
