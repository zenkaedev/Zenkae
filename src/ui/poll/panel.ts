// src/ui/poll/panel.ts
import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { pollStore } from '../../modules/poll/store';
import { pollIds } from './ids';

const V2 = {
  ActionRow: 1,
  Button: 2,
  TextDisplay: 10,
  Separator: 14,
  Container: 17,
} as const;

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

function renderButtons(
  pollId: string,
  options: string[],
  disabled = false,
  multi = false,
) {
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

function unixTs(d: Date) {
  return Math.floor(d.getTime() / 1000);
}

/* ----------------------- payload ----------------------- */

export function buildPollPayload(
  poll: {
    id: string;
    question: string;
    optionsJson: string;
    multi?: boolean;
    endsAt?: Date | string | null;
  },
  counts: Record<number, number>,
) {
  const options: string[] = JSON.parse(poll.optionsJson);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const lines = options
    .map((o, i) => {
      const c = counts[i] ?? 0;
      const pct = total ? Math.round((c * 100) / total) : 0;
      return `**${esc(o)}**\n${bar(c, total)}  ·  ${c} voto(s) — ${pct}%`;
    })
    .join('\n\n');

  const ends = poll.endsAt
    ? new Date(typeof poll.endsAt === 'string' ? poll.endsAt : poll.endsAt)
    : null;
  const expired = !!ends && ends.getTime() <= Date.now();

  const children: any[] = [];
  children.push({ type: V2.TextDisplay, content: `# 📊 ${esc(poll.question)}` });
  if (ends) {
    children.push({
      type: V2.TextDisplay,
      content: `_Encerra em: <t:${unixTs(ends)}:f>_`,
    });
  }
  children.push({ type: V2.Separator, divider: true, spacing: 1 });
  children.push({ type: V2.TextDisplay, content: lines || '_Sem votos ainda._' });

  const btnRows = renderButtons(poll.id, options, expired, !!poll.multi);

  const adminRow = {
    type: V2.ActionRow,
    components: [
      {
        type: V2.Button,
        style: ButtonStyle.Secondary,
        custom_id: pollIds.results(poll.id),
        label: 'Ver resultados',
        emoji: { name: '📈' },
      },
      {
        type: V2.Button,
        style: ButtonStyle.Danger,
        custom_id: pollIds.close(poll.id),
        label: 'Encerrar',
        emoji: { name: '⛔' },
        disabled: expired,
      },
    ],
  } as const;

  return {
    flags: 1 << 15, // MessageFlags.IsComponentsV2
    components: [{ type: V2.Container, components: [...children, ...btnRows, adminRow] }],
  } as const;
}

/* ----------------------- criar enquete ----------------------- */

export async function openCreatePollModal(inter: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId(pollIds.createModal).setTitle('Nova Enquete');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('q')
        .setLabel('Pergunta')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(200),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('o')
        .setLabel('Opções (separe por ";")')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(400),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('multi')
        .setLabel('Múltipla escolha? (s/n)')
        .setRequired(false)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(1),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('end')
        .setLabel('Encerra quando? (ex: 2025-09-10 20:00 ou 2h/1d)')
        .setRequired(false)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(32),
    ),
  );

  await inter.showModal(modal);
}

function parseEndsAt(txt?: string | null): Date | null {
  const s = (txt ?? '').trim();
  if (!s) return null;

  // relativo: 10s, 5m, 2h, 1d
  if (/^\d+[smhd]$/.test(s)) {
    const n = parseInt(s, 10);
    const ch = s.slice(-1);
    const ms =
      ch === 's'
        ? n * 1000
        : ch === 'm'
        ? n * 60 * 1000
        : ch === 'h'
        ? n * 3600 * 1000
        : n * 24 * 3600 * 1000;
    return new Date(Date.now() + ms);
  }

  // absoluto: "YYYY-MM-DD HH:mm"
  const dt = new Date(s.replace(' ', 'T'));
  return isNaN(+dt) ? null : dt;
}

export async function handleCreatePollSubmit(inter: ModalSubmitInteraction) {
  if (!inter.inCachedGuild()) return;
  await inter.deferReply({ flags: MessageFlags.Ephemeral });

  const q = inter.fields.getTextInputValue('q')?.trim();
  const raw = inter.fields.getTextInputValue('o')?.trim();
  const multi = /^s$/i.test((inter.fields.getTextInputValue('multi') || '').trim());
  const end = parseEndsAt((inter.fields.getTextInputValue('end') || '').trim());

  const options =
    (raw || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10) || [];

  if (!q || options.length < 2) {
    await inter.editReply('❌ Informe uma pergunta e pelo menos 2 opções.');
    return;
  }

  const poll = await pollStore.create({
    guildId: inter.guildId!,
    channelId: inter.channelId!,
    question: q,
    options,
    multi,
    endsAt: end,
    createdById: inter.user.id,
  });

  const counts = await pollStore.countVotes(poll.id);
  const payload = buildPollPayload(poll, counts);
  const sent = await (inter.channel as any).send(payload);
  await pollStore.setMessageRef(poll.id, sent.channel.id, sent.id);

  await inter.editReply('✅ Enquete criada!');
}

/* ----------------------- botões (votar/fechar/resultados) ----------------------- */

export async function handlePollButton(inter: ButtonInteraction) {
  if (!inter.inCachedGuild() || !inter.customId) return;

  // ---------- Encerrar ----------
  if (inter.customId.startsWith('poll:close:')) {
    const pollId = inter.customId.split(':').pop();
    if (!pollId) {
      await inter.reply({ content: '❌ ID da enquete inválido.', flags: MessageFlags.Ephemeral });
      return;
    }

    const poll = await pollStore.getById(pollId);
    if (!poll) {
      await inter.reply({ content: '❌ Enquete não encontrada.', flags: MessageFlags.Ephemeral });
      return;
    }

    // persistir encerramento (se existir no store)
    try {
      const now = new Date();
      // @ts-ignore opcional: implemente no store quando quiser persistir
      if (typeof (pollStore as any).updateEndsAt === 'function') {
        await (pollStore as any).updateEndsAt(pollId, now);
        (poll as any).endsAt = now;
      } else {
        (poll as any).endsAt = now;
      }
    } catch {
      /* ignore */
    }

    const counts = await pollStore.countVotes(pollId);
    const payload = buildPollPayload(poll as any, counts);
    try {
      await inter.update(payload);
    } catch {
      await inter.reply({ ...(payload as any), flags: MessageFlags.Ephemeral } as any);
    }
    return;
  }

  // ---------- Ver resultados ----------
  if (inter.customId.startsWith('poll:results:')) {
    const pollId = inter.customId.split(':').pop();
    if (!pollId) {
      await inter.reply({ content: '❌ ID da enquete inválido.', flags: MessageFlags.Ephemeral });
      return;
    }

    const poll = await pollStore.getById(pollId);
    if (!poll) {
      await inter.reply({ content: '❌ Enquete não encontrada.', flags: MessageFlags.Ephemeral });
      return;
    }
    const counts = await pollStore.countVotes(pollId);
    const payload = buildPollPayload(poll, counts);
    await inter.reply({ ...(payload as any), flags: MessageFlags.Ephemeral } as any);
    return;
  }

  // ---------- Votar ----------
  if (pollIds.isVote(inter.customId)) {
    const parsed = pollIds.parseVote(inter.customId);
    const pollId = parsed.pollId ?? null;
    const idx = parsed.idx;

    if (!pollId) {
      await inter.reply({ content: '❌ ID da enquete inválido.', flags: MessageFlags.Ephemeral });
      return;
    }

    const poll = await pollStore.getById(pollId);
    if (!poll) {
      await inter.reply({ content: '❌ Enquete não encontrada.', flags: MessageFlags.Ephemeral });
      return;
    }

    const ends = poll.endsAt ? new Date(poll.endsAt) : null;
    const expired = !!ends && ends.getTime() <= Date.now();
    if (expired) {
      await inter.reply({ content: '⛔ Esta enquete está encerrada.', flags: MessageFlags.Ephemeral });
      return;
    }

    const options: string[] = JSON.parse(poll.optionsJson);
    if (idx < 0 || idx >= options.length) {
      await inter.reply({ content: '❌ Opção inválida.', flags: MessageFlags.Ephemeral });
      return;
    }

    await pollStore.addOrToggleVote(pollId, inter.user.id, idx, !!poll.multi);

    const counts = await pollStore.countVotes(pollId);
    const payload = buildPollPayload(poll, counts);
    try {
      await inter.update(payload);
    } catch {
      await inter.reply({ ...(payload as any), flags: MessageFlags.Ephemeral } as any);
    }
  }
}
