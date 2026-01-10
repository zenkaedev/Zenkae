// src/modules/admin/panel.ts
import { RoleSelectMenuBuilder, RoleSelectMenuInteraction, MessageFlags } from 'discord.js';
import { Context } from '../../infra/context.js';
import { buildScreen } from '../../ui/v2.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

/**
 * Main Admin Dashboard
 */
export async function renderAdminHome(guildId: string) {
    return buildScreen({
        title: 'Admin',
        subtitle: 'Central de controle do servidor.',
        body:
            `**Utilitários:**\n` +
            `- **Check-in Semanal:** Ativar/Desativar mensagem automática.\n` +
            `- **Limpeza:** Remover mensagens do bot.\n\n` +
            `**Configurações:**\n` +
            `- **Ranking:** Definir cargos de premiação (Semanal/Mensal).`,
        buttons: [
            { id: 'admin:config:rank', label: '🏆 Configurar Ranking' },
            { id: 'activity:publish', label: '📅 Check-in Semanal' },
        ],
        back: { id: 'dash:home', label: 'Voltar' },
    });
}

/**
 * Rank Configuration Panel
 */
export async function renderRankConfig(guildId: string) {
    const settings = await prisma.rankSettings.findUnique({ where: { guildId } });

    const weeklyRole = settings?.weeklyRoleId ? `<@&${settings.weeklyRoleId}>` : '_Não definido_';
    const monthlyRole = settings?.monthlyRoleId ? `<@&${settings.monthlyRoleId}>` : '_Não definido_';

    const selectWeekly = new RoleSelectMenuBuilder()
        .setCustomId('admin:rank:weekly')
        .setPlaceholder('Selecionar Cargo Semanal (Top 1)');

    const selectMonthly = new RoleSelectMenuBuilder()
        .setCustomId('admin:rank:monthly')
        .setPlaceholder('Selecionar Cargo Mensal (Top 1)');

    return buildScreen({
        title: 'Configuração de Ranking',
        subtitle: 'Defina os cargos que serão entregues automaticamente aos vencedores do Ranking de XP.',
        body:
            `**Cargo Semanal (Top 1):** ${weeklyRole}\n` +
            `**Cargo Mensal (Top 1):** ${monthlyRole}\n\n` +
            `Use os menus abaixo para selecionar os cargos.`,
        selects: [selectWeekly, selectMonthly],
        back: { id: 'admin:home', label: 'Voltar' },
    });
}
