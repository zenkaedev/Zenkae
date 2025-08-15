// src/modules/recruit/store.drafts.ts
// Rascunho em memória por guildId:userId (nick & classId).

export interface UserDraft {
  nick?: string;
  classId?: string;
}

type Key = string;
type Entry = { value: UserDraft; expiresAt: number };

const store = new Map<Key, Entry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutos de validade para o rascunho

function k(gid: string, uid: string): Key {
  return `${gid}:${uid}`;
}

/** Salva/atualiza o rascunho de um usuário. */
export function setUserDraft(guildId: string, userId: string, data: Partial<UserDraft>) {
  sweep();
  const key = k(guildId, userId);
  const existing = store.get(key)?.value ?? {};
  const newValue = { ...existing, ...data };
  store.set(key, { value: newValue, expiresAt: Date.now() + TTL_MS });
}

/** Obtém o rascunho de um usuário. */
export function getUserDraft(guildId: string, userId: string): UserDraft {
  sweep();
  const key = k(guildId, userId);
  const hit = store.get(key);
  if (!hit) return {};
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return {};
  }
  return hit.value;
}

/** Limpa o rascunho de um usuário. */
export function clearUserDraft(guildId: string, userId: string) {
  store.delete(k(guildId, userId));
}

/** Remove rascunhos expirados para evitar vazamento de memória. */
function sweep() {
  const now = Date.now();
  for (const [key, ent] of store) {
    if (ent.expiresAt < now) store.delete(key);
  }
}
