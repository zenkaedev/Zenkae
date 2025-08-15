// src/modules/recruit/auto-assign.ts
// Automação a ser chamada no fluxo de aprovação (NÃO altera seus handlers atuais).
// Você apenas importa e chama applyApprovalAutomation(...) quando aprovar.

import type { Guild, GuildMember } from 'discord.js';

export interface ApprovalContext {
  guild: Guild;
  member: GuildMember | null; // passe null se não tiver; tentamos buscar
  userId: string;
  nick?: string | null;
  classId?: string | null;
  settings: {
    defaultApprovedRoleId?: string | null;
    classes?: Array<{ id: string; roleId?: string | null }>;
  };
}

export async function applyApprovalAutomation(ctx: ApprovalContext) {
  const { guild, userId, nick, classId } = ctx;
  let member = ctx.member;

  try {
    if (!member) member = await guild.members.fetch(userId);
  } catch {
    member = null;
  }
  if (!member) return;

  // Apelido
  if (nick && member.manageable) {
    try {
      await member.setNickname(nick, 'Recruit approved: set nick');
    } catch {}
  }

  // Cargos (padrão + classe)
  const toAdd: string[] = [];
  if (ctx.settings.defaultApprovedRoleId) toAdd.push(ctx.settings.defaultApprovedRoleId);
  if (classId && ctx.settings.classes?.length) {
    const cls = ctx.settings.classes.find((c) => String(c.id) === String(classId));
    if (cls?.roleId) toAdd.push(cls.roleId);
  }

  if (toAdd.length) {
    try {
      await member.roles.add(toAdd, 'Recruit approved: assign roles');
    } catch {}
  }
}
