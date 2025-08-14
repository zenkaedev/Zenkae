// src/core/guards.ts
// Guards simples em memória: cooldown + dedupe + verificação de permissão de staff.

import type { Interaction, GuildMember, PermissionResolvable } from 'discord.js';

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: 'NO_PERM' | 'COOLDOWN' | 'DUP' | 'ALREADY_PROCESSED' };

const cooldowns = new Map<string, number>();
const dedupes = new Map<string, number>();

/** Anti-spam: bloqueia nova ação até passar o ttlMs */
export function withCooldown(key: string, ttlMs: number): GuardResult {
  const now = Date.now();
  const until = cooldowns.get(key) ?? 0;
  if (until > now) return { ok: false, reason: 'COOLDOWN' };
  cooldowns.set(key, now + ttlMs);
  return { ok: true };
}

/** Evita cliques/processo duplicado por uma pequena janela */
export function withDedupe(key: string, ttlMs: number): GuardResult {
  const now = Date.now();
  const until = dedupes.get(key) ?? 0;
  if (until > now) return { ok: false, reason: 'DUP' };
  dedupes.set(key, now + ttlMs);
  return { ok: true };
}

/** Permite se tiver cargo de staff configurado OU permissão ManageGuild */
export function isStaff(ix: Interaction, staffRoleId: string | null): GuardResult {
  try {
    const member = (ix.guild?.members?.cache?.get(ix.user.id) ?? null) as GuildMember | null;
    if (!member) return { ok: false, reason: 'NO_PERM' };

    if (staffRoleId && member.roles.cache.has(staffRoleId)) return { ok: true };
    if (member.permissions.has('ManageGuild' as PermissionResolvable)) return { ok: true };

    return { ok: false, reason: 'NO_PERM' };
  } catch {
    return { ok: false, reason: 'NO_PERM' };
  }
}
