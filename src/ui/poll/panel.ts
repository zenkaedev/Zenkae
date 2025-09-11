// src/ui/poll/panel.ts — resultados detalhados com displayName (fallback sem alterar store)
import {
  ActionRowBuilder,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
} from 'discord.js';
import { pollStore } from '../../modules/poll/store';
import { pollIds } from './ids';

const V2 = { ActionRow: 1, Button: 2, TextDisplay: 10, Separator: 14, Container: 17 } as const;

/* ----------------------- cache de votos (fallback) ----------------------- */
// Estrutura: pollId -> optionIdx -> Set<userId>
const voteCache: Map<string, Map<number, Set<string>>> = new Map();
const getOptMap = (pollId: string) => {
  let m = voteCache.get(pollId);
  if (!m) { m = new Map(); voteCache.set(pollId, m); }
  return m;
};
const cacheAdd = (pollId: string, idx: number, uid: string) => {
  const m = getOptMap(pollId);
  const s = m.get(idx) ?? new Set<string>(); s.add(uid); m.set(idx, s);
};
const cacheRemove = (pollId: string, idx: number, uid: string) => {
  const m = getOptMap(pollId);
  const s = m.get(idx); if (s) { s.delete(uid); if (!s.size) m.delete(idx); }
};
const cacheClearOther = (pollId: string, keepIdx: number, uid: string) => {
  const m = getOptMap(pollId);
  for (const [k, s] of m) if (k !== keepIdx) s.delete(uid);
};

/* ----------------------- helpers ----------------------- */

const bar = (n: number, tot: number, width = 14) => {
  if (tot <= 0) return '—';
  const ratio = Math.min(1, n / tot);
  const filled = Math.round(width * ratio);
  const empty = Math.max(0, width - filled);
  return '▰'.repeat(filled) + '▱'.repeat(empty);
};

function esc(s?: string | null) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`');
}

function renderButtons(pollId: string, options: string[], disabled = false, multi = false) {
  const rows: any[] = [];
  for (let i = 0; i < options.length; i += 5) {
    const slice = options.slice(i, i + 5);
    rows.push({
      type: V2.ActionRow,
      components: slice.map((label, j) => ({
        type: V2.Button,
        style: multi ? ButtonStyle.Secondary : ButtonStyle.Primary,
        label: label.slice(0, 80),
        custom_id: pollIds.vote(pollId, i + j),
        disabled,
      })),
    });
  }
  return rows;
}

function unixTs(d: Date) { return Math.floor(d.getTime() / 1000); }

/* ----------------------- payload ----------------------- */

// Aceita { optionsJson } ou { options }
type PollLike = {
  id: string; question: string; multi?: boolean;
  endsAt?: Date | string | null; optionsJson?: string; options?: string[];
};

function getOptionsArray(poll: PollLike): string[] {
  if (Array.isArray(poll.options)) return poll.options;
  if (poll.optionsJson) { try { return JSON.parse(poll.optionsJson) as string[]; } catch { return []; } }
  return [];
}

export function buildPollPayload(poll: PollLike, counts: Record<number, number>) {
  const options = getOptionsArray(poll);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const lines = options.map((o, i) => {
    const c = counts[i] ?? 0;
    const pct = total ? Math.round((c * 100) / total) : 0;
    return `**${esc(o)}**\n${bar(c, total)}  ·  ${c} voto(s) — ${pct}%`;
  }).join('\n\n');

  const ends = poll.endsAt ? new Date(typeof poll.endsAt === 'string' ? poll.endsAt : poll.endsAt) : null;
  const expired = !!ends && ends.getTime() <= Date.now();

  const children: any[] = [];
  children.push({ type: V2.TextDisplay, content: `# 📊 ${esc(poll.question)}` });
  if (ends) children.push({ type: V2.TextDisplay, content: `_Encerra em: <t:${unixTs(ends)}:f>_` });
  children.push({ type: V2.Separator, divider: true, spacing: 1 });
  children.push({ type: V2.TextDisplay, content: lines || '_Sem votos ainda._' });

  const btnRows = renderButtons(poll.id, options, expired, !!poll.multi);
  const adminRow = {
    type: V2.ActionRow,
    components: [
      { type: V2.Button, style: ButtonStyle.Secondary, custom_id: pollIds.results(poll.id), label: 'Ver resultados', emoji: { name: '📈' } },
      { type: V2.Button, style: ButtonStyle.Danger, custom_id: pollIds.close(poll.id),    label: 'Encerrar',       emoji: { name: '⛔' }, disabled: expired },
    ],
  } as const;

  return { flags: 1 << 15, components: [{ type: V2.Container, components: [...children, ...btnRows, adminRow] }] } as const;
}

/* ----------------------- criar enquete ----------------------- */

export async function openCreatePollModal(inter: ChatInputCommandInteraction | ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId(pollIds.createModal).setTitle('Nova Enquete');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('q').setLabel('Pergunta').setRequired(true).setStyle(TextInputStyle.Short).setMaxLength(200),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('o').setLabel('Opções')
        .setPlaceholder('Separe por ; — ex.: Sim; Não; Talvez')
        .setRequired(true).setStyle(TextInputStyle.Paragraph).setMaxLength(400),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('multi').setLabel('Múltipla escolha? (s/n)').setRequired(false).setStyle(TextInputStyle.Short).setMaxLength(1),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('end').setLabel('Encerra quando?')
        .setPlaceholder('Ex.: 2025-09-10 20:00 ou 2h/1d').setRequired(false).setStyle(TextInputStyle.Short).setMaxLength(32),
    ),
  );
  await inter.showModal(modal);
}

/* ----------------------- submit do modal ----------------------- */

function parseEndsAt(txt?: string | null): Date | null {
  const s = (txt ?? '').trim(); if (!s) return null;
  if (/^\d+[smhd]$/.test(s)) {
    const n = parseInt(s, 10); const ch = s.slice(-1);
    const ms = ch === 's' ? n * 1000 : ch === 'm' ? n * 60_000 : ch === 'h' ? n * 3_600_000 : n * 86_400_000;
    return new Date(Date.now() + ms);
  }
  const dt = new Date(s.replace(' ', 'T')); return isNaN(+dt) ? null : dt;
}

export async function handleCreatePollSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild()) return;
  await inter.deferReply({ flags: MessageFlags.Ephemeral });

  const q = inter.fields.getTextInputValue('q')?.trim();
  const raw = inter.fields.getTextInputValue('o')?.trim();
  const multi = /^s$/i.test((inter.fields.getTextInputValue('multi') || '').trim());
  const end = parseEndsAt((inter.fields.getTextInputValue('end') || '').trim());

  const options = (raw || '').split(';').map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (!q || options.length < 2) { await inter.editReply('❌ Informe uma pergunta e pelo menos 2 opções.'); return; }

  const poll = await pollStore.create({
    guildId: inter.guildId!, channelId: inter.channelId!,
    question: q, options, multi, endsAt: end, createdById: inter.user.id,
  });

  const counts = await pollStore.countVotes(poll.id);
  const payload = buildPollPayload(poll as any, counts);
  const sent = await (inter.channel as any).send(payload);
  await pollStore.setMessageRef(poll.id, sent.channel.id, sent.id);

  await inter.editReply('✅ Enquete criada!');
}

/* ----------------------- botões (votar/fechar/resultados) ----------------------- */

async function safeReply(inter: ButtonInteraction, content: string | { content: string } | any) {
  const opts = typeof content === 'string' ? { content } : content;
  if (inter.deferred || inter.replied) await inter.followUp({ ...opts, flags: MessageFlags.Ephemeral }).catch(() => {});
  else await inter.reply({ ...opts, flags: MessageFlags.Ephemeral }).catch(() => {});
}

// Busca nomes exibidos no servidor para uma lista de userIds
async function fetchDisplayNames(guild: Guild, userIds: string[]) {
  const unique = Array.from(new Set(userIds)).slice(0, 200);
  const entries = await Promise.all(unique.map(async (id) => {
    try { const m = await guild.members.fetch(id); return [id, m.displayName] as const; }
    catch { return [id, `@${id}`] as const; }
  }));
  return Object.fromEntries(entries) as Record<string, string>;
}

// Tenta obter votos detalhados do store; se não houver, usa o cache local
async function getVotesByOptionCompat(pollId: string) {
  const s: any = pollStore as any;

  if (typeof s.getVotesByOption === 'function') {
    try { const r = await s.getVotesByOption(pollId); if (r && typeof r === 'object') return r as Record<number, string[]>; } catch {}
  }

  if (typeof s.listVotes === 'function' || typeof s.getVotes === 'function') {
    try {
      const arr: Array<{ userId: string; optionIdx: number }> =
        (typeof s.listVotes === 'function' ? await s.listVotes(pollId) : await s.getVotes(pollId)) || [];
      const map: Record<number, string[]> = {};
      for (const v of arr) { (map[v.optionIdx] ||= []).push(v.userId); }
      return map;
    } catch {}
  }

  // Fallback: cache em memória
  const m = voteCache.get(pollId) ?? new Map<number, Set<string>>();
  const result: Record<number, string[]> = {};
  for (const [idx, set] of m) result[idx] = Array.from(set);
  return result;
}

export async function handlePollButton(inter: ButtonInteraction) {
  if (!inter.inCachedGuild() || !inter.customId) return;

  try {
    // Encerrar
    if (inter.customId.startsWith('poll:close:')) {
      const pollId = inter.customId.split(':').pop();
      if (!pollId) return safeReply(inter, '❌ ID da enquete inválido.');
      const poll = await pollStore.getById(pollId);
      if (!poll) return safeReply(inter, '❌ Enquete não encontrada.');

      try {
        const now = new Date();
        if (typeof (pollStore as any).updateEndsAt === 'function') { await (pollStore as any).updateEndsAt(pollId, now); (poll as any).endsAt = now; }
        else (poll as any).endsAt = now;
      } catch {}

      const counts = await pollStore.countVotes(pollId);
      const payload = buildPollPayload(poll as any, counts);
      try { await inter.update(payload); } catch { await safeReply(inter, payload as any); }
      return;
    }

    // Ver resultados — com nomes (displayName) via store OU cache
    if (inter.customId.startsWith('poll:results:')) {
      const pollId = inter.customId.split(':').pop();
      if (!pollId) return safeReply(inter, '❌ ID da enquete inválido.');
      const poll = await pollStore.getById(pollId);
      if (!poll) return safeReply(inter, '❌ Enquete não encontrada.');

      await inter.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      const options = getOptionsArray(poll as any);
      const byOption = await getVotesByOptionCompat(pollId);

      const allUserIds = Object.values(byOption).flat().filter(Boolean);
      const nameMap = await fetchDisplayNames(inter.guild!, allUserIds);

      const blocks: string[] = [];
      for (let i = 0; i < options.length; i++) {
        const voters = (byOption[i] ?? []).filter(Boolean);
        const names = voters.map((uid) => esc(nameMap[uid] ?? `@${uid}`));
        const header = `**${esc(options[i])}** — ${voters.length} voto(s)`;
        const list = names.length ? names.join(', ') : '_— sem votos —_';
        blocks.push(`${header}\n${list}`);
      }
      const content = `**Resultados detalhados**\nPergunta: **${esc((poll as any).question)}**\n\n` + blocks.join('\n\n');
      await inter.editReply({ content }).catch(() => {});
      return;
    }

    // Votar
    if (pollIds.isVote(inter.customId)) {
      const { pollId, idx } = pollIds.parseVote(inter.customId);
      if (!pollId) return safeReply(inter, '❌ ID da enquete inválido.');
      const poll = await pollStore.getById(pollId);
      if (!poll) return safeReply(inter, '❌ Enquete não encontrada.');

      const ends = (poll as any).endsAt ? new Date((poll as any).endsAt) : null;
      if (ends && ends.getTime() <= Date.now()) return safeReply(inter, '⛔ Esta enquete está encerrada.');

      const options = getOptionsArray(poll as any);
      if (idx < 0 || idx >= options.length) return safeReply(inter, '❌ Opção inválida.');

      await (pollStore as any).addOrToggleVote(pollId, inter.user.id, idx, !!(poll as any).multi);

      // Atualiza cache (para resultados com nomes sem depender do store)
      if ((poll as any).multi) {
        // multi: alterna presença do voto nesta opção
        const optSet = getOptMap(pollId).get(idx) ?? new Set<string>();
        if (optSet.has(inter.user.id)) cacheRemove(pollId, idx, inter.user.id);
        else cacheAdd(pollId, idx, inter.user.id);
      } else {
        // single: limpa votos do usuário em outras opções e marca esta
        cacheClearOther(pollId, idx, inter.user.id);
        cacheAdd(pollId, idx, inter.user.id);
      }

      const counts = await pollStore.countVotes(pollId);
      const payload = buildPollPayload(poll as any, counts);
      try { await inter.update(payload); } catch { await safeReply(inter, payload as any); }
    }
  } catch (err: any) {
    await safeReply(inter, { content: `❌ Erro: \`${err?.message ?? String(err)}\`` });
    try { console.error('[poll:button] error', err); } catch {}
  }
}
