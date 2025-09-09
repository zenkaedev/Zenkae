// src/routers/recruit/index.ts — completo corrigido
// Correções aplicadas:
// - Remove uso de `getFormConfig` (não existe no GuildConfigRepo atual)
// - Usa `recruitStore.getSettings()` e lê/escreve o form a partir de `settings.recruit?.form` (com fallback)
// - Evita chamar handlers ao registrar rotas (corrige ts(2554): "Expected 0 arguments, but got 1")

import type { Class } from '../../modules/recruit/store.js';
import { recruitStore } from '../../modules/recruit/store.js';

/* Tipos genéricos para o seu roteador (Express/Koa-like). Ajuste se necessário. */
export type RouterLike = {
  get: (path: string, handler: (ctx: any, next?: any) => any | Promise<any>) => void;
  post: (path: string, handler: (ctx: any, next?: any) => any | Promise<any>) => void;
};

/* Tipo do formulário de recrutamento — ajuste conforme seu projeto */
export type RecruitFormQuestion = {
  id: string;
  label: string;
  type: 'text' | 'longtext' | 'number' | 'choice' | 'multi';
  required?: boolean;
  options?: string[]; // para choice/multi
};

export type RecruitFormConfig = {
  enabled: boolean;
  questions: RecruitFormQuestion[];
};

const DEFAULT_FORM_CONFIG: RecruitFormConfig = {
  enabled: true,
  questions: [],
};

/* Helpers: ler/escrever config do formulário dentro de settings */
async function readFormConfig(guildId: string): Promise<RecruitFormConfig> {
  const s = await recruitStore.getSettings(guildId);
  // possíveis locais: settings.recruit.form | settings.form
  const form: RecruitFormConfig | undefined = (s as any)?.recruit?.form ?? (s as any)?.form;
  return form ?? DEFAULT_FORM_CONFIG;
}

async function writeFormConfig(guildId: string, form: RecruitFormConfig): Promise<void> {
  // update parcial — o store costuma aceitar patchs (ex.: { classes })
  await recruitStore.updateSettings(guildId, { recruit: { ...(await (async () => (await recruitStore.getSettings(guildId) as any)?.recruit ?? {} )()), form } } as any);
}

/* Registro das rotas */
export function registerRecruitRouter(router: RouterLike) {
  // GET /recruit/form/:guildId — retorna config do formulário
  router.get('/recruit/form/:guildId', async (ctx: any) => {
    const guildId: string = ctx.params?.guildId ?? ctx.req?.params?.guildId;
    if (!guildId) {
      ctx.status = 400;
      ctx.body = { error: 'guildId é obrigatório' };
      return;
    }
    const form = await readFormConfig(guildId);
    // Express: res.json; Koa: ctx.body
    if (ctx.json) return ctx.json(form);
    ctx.body = form;
  });

  // POST /recruit/form/:guildId — salva config do formulário
  router.post('/recruit/form/:guildId', async (ctx: any) => {
    const guildId: string = ctx.params?.guildId ?? ctx.req?.params?.guildId;
    const body = ctx.body ?? ctx.request?.body ?? ctx.req?.body;
    if (!guildId) {
      ctx.status = 400;
      ctx.body = { error: 'guildId é obrigatório' };
      return;
    }
    if (!body || typeof body !== 'object') {
      ctx.status = 400;
      ctx.body = { error: 'payload inválido' };
      return;
    }
    const incoming = body as Partial<RecruitFormConfig>;
    const current = await readFormConfig(guildId);
    const merged: RecruitFormConfig = {
      ...current,
      ...incoming,
      questions: Array.isArray(incoming.questions) ? incoming.questions : current.questions,
    };
    await writeFormConfig(guildId, merged);
    if (ctx.json) return ctx.json({ ok: true, form: merged });
    ctx.body = { ok: true, form: merged };
  });
}

export default registerRecruitRouter;
