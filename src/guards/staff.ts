import { PermissionsBitField, type GuildMember, type RepliableInteraction, MessageFlags } from 'discord.js';
import { Env } from '../env.js';

export function isStaffMember(member?: GuildMember | null) {
  if (!member) return false;
  const hasPerm =
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.ManageRoles);
  const hasRole = Env.STAFF_ROLE_ID ? member.roles.cache.has(Env.STAFF_ROLE_ID) : false;
  return hasPerm || hasRole;
}

export async function assertStaff(interaction: RepliableInteraction): Promise<boolean> {
  if (!interaction.inCachedGuild()) {
    try { await interaction.reply({ content: '❌ Apenas em servidores.', flags: MessageFlags.Ephemeral }); } catch {}
    return false;
  }
  const member = interaction.member as GuildMember | null;
  if (isStaffMember(member)) return true;
  try { await interaction.reply({ content: '⛔ Somente staff.', flags: MessageFlags.Ephemeral }); } catch {}
  return false;
}
