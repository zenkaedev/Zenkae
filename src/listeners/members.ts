import { Client, Events } from 'discord.js';
import { updateMembersPanel } from '../modules/recruit/members.js';
import { logger } from '../infra/logger.js';

export function registerMembersListeners(client: Client) {

    // Member Joined
    client.on(Events.GuildMemberAdd, async (member) => {
        // Only update if it's the target guild(s)? 
        // We check inside updateMembersPanel if the guild has the panel configured.
        if (member.user.bot) return;
        await updateMembersPanel(member.guild);
    });

    // Member Left
    client.on(Events.GuildMemberRemove, async (member) => {
        if (member.user.bot) return;
        await updateMembersPanel(member.guild);
    });

    // Member Updated (Roles changed, Nickname changed)
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        if (newMember.user.bot) return;

        // Check if relevant changes occurred (roles or nickname)
        const rolesChanged = !oldMember.roles.cache.equals(newMember.roles.cache);
        const nickChanged = oldMember.nickname !== newMember.nickname; // Only check nickname, not displayname (derived)

        if (rolesChanged || nickChanged) {
            await updateMembersPanel(newMember.guild);
        }
    });

    logger.info('✅ Listeners de Membros registrados');
}
