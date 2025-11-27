// Garante 1..4000 chars e nunca envia Text Display vazio
export function td(raw?: string | null) {
  const s = (raw ?? '').trim();
  if (s.length === 0) return null;
  return { type: 10 as const, content: s.slice(0, 4000) };
}

// Se quiser sempre mostrar algo, usa "—"
export function tdOrDash(raw?: string | null) {
  const s = (raw ?? '').trim();
  return { type: 10 as const, content: s.length === 0 ? '—' : s.slice(0, 4000) };
}
