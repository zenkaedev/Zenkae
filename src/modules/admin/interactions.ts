// src/modules/admin/interactions.ts
import { InteractionRouter } from '../../infra/router.js';
import { renderAdminHome, renderRankConfig } from './panel.js';
import { MessageFlags, RoleSelectMenuInteraction } from 'discord.js';
import { Context } from '../../infra/context.js';
import { ids } from '../../ui/ids.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

export const adminRouter = new InteractionRouter();

// Home
adminRouter.button('admin:home', async (interaction) => {
    if (!interaction.isButton()) return;
    const payload = await renderAdminHome(interaction.guildId!);
    await interaction.update(payload);
});


// Clean Message (Utility)
adminRouter.button('admin:clean', async (interaction) => {
    if (!interaction.isButton()) return;
    try {
        await interaction.message.delete();
    } catch {
        await interaction.reply({ content: '❌ Não foi possível deletar a mensagem.', flags: MessageFlags.Ephemeral });
    }
});

// === RANK CONFIG ===

adminRouter.button('admin:config:rank', async (interaction) => {
    if (!interaction.isButton()) return;
    const payload = await renderRankConfig(interaction.guildId!);
    await interaction.update(payload);
});

async function handleRoleSelect(interaction: RoleSelectMenuInteraction, type: 'weekly' | 'monthly') {
    const roleId = interaction.values[0];
    const role = interaction.guild?.roles.cache.get(roleId);

    if (!role) {
        await interaction.reply({ content: '❌ Cargo não encontrado.', flags: MessageFlags.Ephemeral });
        return;
    }

    const updateData: any = {};
    if (type === 'weekly') updateData.weeklyRoleId = roleId;
    if (type === 'monthly') updateData.monthlyRoleId = roleId;

    await prisma.rankSettings.upsert({
        where: { guildId: interaction.guildId! },
        create: { guildId: interaction.guildId!, ...updateData },
        update: updateData
    });

    // Re-render
    const payload = await renderRankConfig(interaction.guildId!);
    await interaction.update(payload);
}

// Role Select Handlers
adminRouter.select('admin:rank:weekly', (i) => handleRoleSelect(i as RoleSelectMenuInteraction, 'weekly'));
adminRouter.select('admin:rank:monthly', (i) => handleRoleSelect(i as RoleSelectMenuInteraction, 'monthly'));
