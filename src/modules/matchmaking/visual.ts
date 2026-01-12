// src/modules/matchmaking/visual.ts

import type { PartySlots } from './types.js';

/**
 * Parse string "Tank:1, Healer:1, DPS:3" para objeto PartySlots
 */
export function parseSlots(input: string): PartySlots {
    const slots: PartySlots = {};
    const parts = input.split(',').map(s => s.trim());

    for (const part of parts) {
        const match = part.match(/^(.+?):(\d+)$/);
        if (match) {
            const roleName = match[1].trim();
            const max = parseInt(match[2]);
            slots[roleName] = { max, members: [] };
        }
    }

    return slots;
}

/**
 * Gera o container visual da party usando codeblocks ASCII
 */
export function renderPartyContainer(data: {
    title: string;
    datetime: string;
    description: string;
    leaderId: string;
    slots: PartySlots;
}): string {
    const { title, datetime, description, leaderId, slots } = data;

    // Header com ASCII box
    const header = [
        '```yaml',
        '╔═══════════════════════════════════════╗',
        `║ ⚔️  ${title.padEnd(34, ' ')}║`,
        `║ 📅 ${datetime.padEnd(34, ' ')}║`,
        '╚═══════════════════════════════════════╝',
        '```',
    ].join('\n');

    // Descrição e líder
    const info = [
        `📝 *${description}*`,
        `👑 **Líder:** <@${leaderId}>`,
        '',
    ].join('\n');

    // Lista de membros por role
    const roleEmojis: Record<string, string> = {
        Tank: '🛡️',
        Healer: '⚕️',
        DPS: '⚔️',
    };

    const memberLines: string[] = ['```diff'];

    for (const [roleName, roleData] of Object.entries(slots)) {
        const emoji = roleEmojis[roleName] || '👥';
        const filled = roleData.members.length;
        const max = roleData.max;

        memberLines.push(`+ ${emoji} ${roleName.toUpperCase()} (${filled}/${max})`);

        // Mostrar membros
        for (const memberId of roleData.members) {
            memberLines.push(`- <@${memberId}>`);
        }

        // Mostrar vagas vazias
        for (let i = filled; i < max; i++) {
            memberLines.push('- [ Vaga Disponível ]');
        }

        memberLines.push(''); // Linha vazia entre roles
    }

    memberLines.push('```');

    return [header, info, memberLines.join('\n')].join('\n\n');
}

/**
 * Retorna ícone para role
 */
export function getRoleEmoji(role: string): string {
    const emojis: Record<string, string> = {
        Tank: '🛡️',
        Healer: '⚕️',
        DPS: '⚔️',
    };
    return emojis[role] || '👥';
}
