// src/services/recruit.state.ts
// Guarda temporariamente a classe escolhida no passo 1 (select).

type Key = string;
type Entry = { value: string; expiresAt: number };

const store = new Map<Key, Entry>();

function k(gid: string, uid: string): Key {
  return `${gid}:${uid}`;
}

export function setSelectedClass(guildId: string, userId: string, value: string, ttlMs = 2 * 60_000) {
  sweep();
  store.set(k(guildId, userId), { value, expiresAt: Date.now() + ttlMs });
}

export function getSelectedClass(guildId: string, userId: string): string | null {
  sweep();
  const hit = store.get(k(guildId, userId));
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(k(guildId, userId));
    return null;
  }
  return hit.value;
}

export function clearSelectedClass(guildId: string, userId: string) {
  store.delete(k(guildId, userId));
}

function sweep() {
  const now = Date.now();
  for (const [key, ent] of store) {
    if (ent.expiresAt < now) store.delete(key);
  }
}
