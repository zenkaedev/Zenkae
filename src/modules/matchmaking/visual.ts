// src/modules/matchmaking/visual.ts

import type { PartySlots } from './types.js';

// Component V2 type IDs
const V2 = {
    ActionRow: 1,
    Button: 2,
    StringSelect: 3,
    TextInput: 4,
    Section: 9,
    TextDisplay: 10,
    Thumbnail: 11,
    MediaGallery: 12,
    File: 13,
    Separator: 14,
    Container: 17,
} as const;

/**
 * Parse string "1, 2, 3" para objeto PartySlots
 * Formato: Tank, Healer, DPS (nessa ordem)
 */
export function parseSlots(input: string): PartySlots {
    const slots: PartySlots = {};
    const numbers = input.split(',').map(s => s.trim()).map(n => parseInt(n) || 0);

    // Roles padrão na ordem: Tank, Healer, DPS
    const defaultRoles = ['Tank', 'Healer', 'DPS'];

    for (let i = 0; i < Math.min(numbers.length, defaultRoles.length); i++) {
        const roleName = defaultRoles[i];
        const max = numbers[i];

        if (max > 0) {
            slots[roleName] = { max, members: [] };
        }
    }

    return slots;
}

/**
 * Gera o container visual da party usando Components V2
 */
export function renderPartyContainer(data: {
    title: string;
    datetime: string;
    description: string;
    leaderId: string;
    slots: PartySlots;
}): any {
    const { title, datetime, description, leaderId, slots } = data;

    // Lista linear de componentes para o container
    const components: any[] = [];

    // 1. Header (Título)
    components.push({
        type: V2.TextDisplay,
        content: `# ${title}`,
    });

    // 2. Info (Data, Descrição, Líder)
    components.push({
        type: V2.TextDisplay,
        content: `**${datetime}**\n*${description}*\n**Líder:** <@${leaderId}>`,
    });

    // 3. Separator
    components.push({
        type: V2.Separator,
        divider: true,
        spacing: 1,
    });

    // Role emojis
    const roleEmojis: Record<string, string> = {
        Tank: '🛡️',
        Healer: '⚕️',
        DPS: '⚔️',
    };

    // 4. Roles
    for (const [roleName, roleData] of Object.entries(slots)) {
        const emoji = roleEmojis[roleName] || '👥';
        const filled = roleData.members.length;
        const max = roleData.max;

        // Lista de membros
        const membersList: string[] = [];
        for (const memberId of roleData.members) {
            membersList.push(`✅ <@${memberId}>`);
        }
        for (let i = filled; i < max; i++) {
            membersList.push(`⬜ Vaga Disponível`);
        }

        // Título da Role
        components.push({
            type: V2.TextDisplay,
            content: `## ${emoji} ${roleName} (${filled}/${max})`,
        });

        // Lista de membros
        components.push({
            type: V2.TextDisplay,
            content: membersList.join('\n'),
        });
    }

    // Container principal
    const container = {
        type: V2.Container,
        accent_color: 0x5865F2, // Blurple do Discord
        components: components,
    };

    return {
        components: [container],
        flags: 1 << 15, // MessageFlags.IsComponentsV2
    };
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
