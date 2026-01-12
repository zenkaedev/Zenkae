// src/modules/suggestions/card.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Brand, getBuilders } from '../../ui/v2.js';
import type { Suggestion } from '@prisma/client';

export interface SuggestionCardData {
    suggestion: Suggestion;
    agreeCount: number;
    disagreeCount: number;
    userVote?: 'agree' | 'disagree' | null;
}

export function buildSuggestionCard(data: SuggestionCardData) {
    const { ContainerBuilder, TextDisplayBuilder } = getBuilders();

    if (!ContainerBuilder || !TextDisplayBuilder) {
        throw new Error('Components V2 not supported');
    }

    const { suggestion, agreeCount, disagreeCount } = data;

    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2); // Discord Blurple

    // Header: Autor
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Sugestão enviada por ${suggestion.userDisplay}**`
        )
    );

    // Título
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${suggestion.title}`
        )
    );

    // Descrição (com quote formatting)
    const quotedDescription = suggestion.description
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(quotedDescription)
    );

    // Votação (apenas 2 botões, thread é automática!)
    const voteRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`suggestion:vote:agree:${suggestion.id}`)
                .setLabel(`Concordo (${agreeCount})`)
                .setEmoji('👍')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`suggestion:vote:disagree:${suggestion.id}`)
                .setLabel(`Discordo (${disagreeCount})`)
                .setEmoji('👎')
                .setStyle(ButtonStyle.Danger)
        );

    container.addActionRowComponents(voteRow);

    const FLAGS_V2 = (MessageFlags as unknown as Record<string, number>).IsComponentsV2 || 128;

    return {
        components: [container],
        flags: FLAGS_V2
    };
}
