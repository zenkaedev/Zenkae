// src/commands/info.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { renderer } from '../services/renderer/index.js';
import { UserProfile } from '../services/renderer/templates/UserProfile.js';
import { xpStore } from '../services/xp/store.js';
import { getMessageCount } from '../listeners/messageCount.js';
import { Context } from '../infra/context.js';
import React from 'react';

const prisma = new Proxy({} as any, {
    get(target, prop) {
        return (Context.get().prisma as any)[prop];
    },
});

export const data = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Mostra informações detalhadas de um usuário')
    .addUserOption(option =>
        option
            .setName('usuario')
            .setDescription('Usuário para ver informações (deixe em branco para ver as suas)')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
        await interaction.reply({ content: '❌ Este comando só funciona em servidores.', flags: 64 });
        return;
    }

    await interaction.deferReply(); // Rendering pode levar ~1s

    const targetUser = interaction.options.getUser('usuario') ?? interaction.user;
    const guildId = interaction.guildId;
    const prisma = Context.get().prisma;

    try {
        // 1. Buscar dados do usuário
        const member = await interaction.guild.members.fetch(targetUser.id);
        const xpData = await xpStore.getUserLevel(guildId, targetUser.id);
        const messageCount = await getMessageCount(guildId, targetUser.id);

        // Get rank position
        const topUsers = await xpStore.getTopUsers(guildId, 999); // Get all to find position
        const userRank = topUsers.findIndex((u: any) => u.userId === targetUser.id) + 1;

        // Voice time - fetch from database
        const voiceData = await prisma.voiceActivity.findUnique({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
        });
        const voiceSeconds = voiceData?.totalSeconds ?? 0;
        const voiceHours = Math.floor(voiceSeconds / 3600);

        // 2. Datas formatadas
        const joinedAt = member.joinedAt
            ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(member.joinedAt)
            : '—';

        // 3. Avatar, Banner e Cargo
        const avatarUrl = targetUser.displayAvatarURL({ size: 256, extension: 'png' });
        const userFull = await targetUser.fetch();
        const bannerUrl = userFull.bannerURL({ size: 1024, extension: 'png' }) ?? undefined;

        // Get Highest Role
        const roles = member.roles.cache
            .filter(r => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position);
        const highestRole = roles.first();
        const roleName = highestRole?.name ?? 'Membro';
        const roleColor = highestRole?.hexColor ?? '#c7d5e0';

        // 4. Renderizar imagem
        const pngBuffer = await renderer.renderToPNG(
            React.createElement(UserProfile, {
                username: member.displayName || targetUser.username,
                avatarUrl,
                bannerUrl,
                level: xpData.level,
                rank: userRank > 0 ? userRank : undefined, // Only show if found
                xpProgress: xpData.xpProgress,
                currentXP: xpData.xpInCurrentLevel,
                requiredXP: xpData.xpForNextLevel,
                messageCount,
                voiceHours,
                memberSince: joinedAt,
                guildColor: roleColor, // Use role color as theme
                roleName, // New Prop
                roleColor, // New Prop
            }),
            { width: 1200, height: 900, fitToWidth: 300 }
        );

        // 5. Enviar como attachment
        const attachment = new AttachmentBuilder(pngBuffer, { name: `${targetUser.username}-profile.png` });

        await interaction.editReply({
            files: [attachment],
        });
    } catch (err) {
        console.error('Error generating profile card:', err);
        await interaction.editReply({
            content: '❌ Erro ao gerar card de perfil. Tente novamente.',
        });
    }
}
