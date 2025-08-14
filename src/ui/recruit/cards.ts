// src/ui/recruit/cards.ts
// <- REMOVIDO botão "Entrevista". Só Aprovar / Rejeitar.
import { actions, button, asV2, EMOJI } from '../common/layout';
import type { AppStatus } from '../../db/repos/application.repo';

export interface ApplicationCardData {
  id: string;
  userId: string;
  status: AppStatus;
  createdAt: Date | string;
  answers: unknown;
}

type QA = { q: string; a: string };

function normalizeAnswers(raw: unknown): QA[] {
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw)) {
      const rows: QA[] = [];
      for (const item of raw as any[]) {
        if (item && typeof item === 'object') {
          const q = (item.question ?? item.label ?? '').toString().trim();
          const aRaw = item.answer ?? item.value ?? '';
          const a =
            typeof aRaw === 'string'
              ? aRaw
              : aRaw == null
              ? ''
              : Array.isArray(aRaw)
              ? aRaw.join(', ')
              : typeof aRaw === 'object'
              ? JSON.stringify(aRaw)
              : String(aRaw);
          if (q || a) rows.push({ q, a });
        }
      }
      if (rows.length) return rows;
    }
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length) {
      return entries.map(([k, v]) => ({
        q: k,
        a:
          typeof v === 'string'
            ? v
            : v == null
            ? ''
            : Array.isArray(v)
            ? v.join(', ')
            : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v),
      }));
    }
  }
  return [{ q: 'Respostas', a: safeStringify(raw) }];
}
function safeStringify(v: unknown) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function renderGrid(rows: QA[]): string {
  const QW = 28, AW = 60;
  const header = `${pad('Pergunta', QW)} | Resposta`;
  const sep = `${'-'.repeat(QW)}-+-${'-'.repeat(AW)}`;
  const body = rows.flatMap(({ q, a }) => {
    const q1 = clip(q.replace(/\s+/g, ' ').trim(), QW);
    const parts = wrapText(a, AW);
    if (parts.length === 0) return [`${pad(q1, QW)} |`];
    return parts.map((part, i) => `${i === 0 ? pad(q1, QW) : ' '.repeat(QW)} | ${part}`);
  }).join('\n');
  return ['```', header, sep, body || '(vazio)', '```'].join('\n');
}
function clip(s: string, max: number) { return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…'; }
function pad(s: string, width: number) { return s.length >= width ? s : s + ' '.repeat(width - s.length); }
function wrapText(text: string, width: number) {
  const words = String(text).split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) {
    if (!cur.length) { cur = clip(w, width); continue; }
    if (cur.length + 1 + w.length <= width) cur += ' ' + w;
    else { lines.push(cur); cur = clip(w, width); }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export function buildApplicationCard(app: ApplicationCardData) {
  const when = app.createdAt instanceof Date ? app.createdAt : new Date(String(app.createdAt));
  const qa = normalizeAnswers(app.answers);
  const header = `**Nova candidatura** — <@${app.userId}>  \nStatus: \`${app.status}\` • ${when.toLocaleString()}`;
  const table = renderGrid(qa);
  const row = actions(
    button(`recruit:approve:${app.id}`, 'Aprovar', 'success', EMOJI.approve),
    button(`recruit:reject:${app.id}`, 'Rejeitar', 'danger', EMOJI.reject),
  );
  return asV2({ content: `${header}\n${table}`, components: [row.toJSON()] });
}

export function buildApplicationCardPreview(userId: string) {
  return buildApplicationCard({
    id: 'preview-app',
    userId,
    status: 'PENDING',
    createdAt: new Date(),
    answers: {
      Nick: 'Marquin do PW',
      Classe: 'Arqueiro',
      Experiência: '3 anos em TW / NW',
      Disponibilidade: 'Seg–Sex 20h–23h',
      Observações: 'Sou ativo em Discord e ajudo no recrutamento também.',
    },
  });
}
