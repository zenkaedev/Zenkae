
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Role } from 'discord.js';
import { Context } from '../infra/context.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

export const data = new SlashCommandBuilder()
    .setName('config-rank')
    .setDescription('Configura premiações do ranking')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s
        .setName('roles')
        .setDescription('Define os cargos de premiação')
        .addRoleOption(o => o.setName('weekly').setDescription('Cargo para Top 1 Semanal').setRequired(false))
        .addRoleOption(o => o.setName('monthly').setDescription('Cargo para Top 1 Mensal').setRequired(false))
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const weeklyRole = interaction.options.getRole('weekly') as Role | null;
    const monthlyRole = interaction.options.getRole('monthly') as Role | null;

    if (!weeklyRole && !monthlyRole) {
        await interaction.reply({ content: '❌ Você precisa selecionar pelo menos um cargo para configurar.', ephemeral: true });
        return;
    }

    const dataToUpdate: any = {};
    const msgs: string[] = [];

    if (weeklyRole) {
        dataToUpdate.weeklyRoleId = weeklyRole.id;
        msgs.push(`✅ Cargo Semanal definido para **${weeklyRole.name}**`);
    }

    if (monthlyRole) {
        dataToUpdate.monthlyRoleId = monthlyRole.id;
        msgs.push(`✅ Cargo Mensal definido para **${monthlyRole.name}**`);
    }

    await prisma.rankSettings.upsert({
        where: { guildId: interaction.guildId },
        create: { guildId: interaction.guildId, ...dataToUpdate },
        update: dataToUpdate
    });

    await interaction.reply({ content: msgs.join('\n'), ephemeral: true });
}
