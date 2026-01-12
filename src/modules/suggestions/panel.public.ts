// src/modules/suggestions/panel.public.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Brand, getBuilders } from '../../ui/v2.js';

export function buildSuggestionPanel() {
    const { ContainerBuilder, TextDisplayBuilder } = getBuilders();

    if (!ContainerBuilder || !TextDisplayBuilder) {
        throw new Error('Components V2 not supported');
    }

    const container = new ContainerBuilder()
        .setAccentColor(Brand.purple);

    // Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            '# DÊ SUA SUGESTÃO! 📢\n\n' +
            'Este canal é destinado para o envio de sugestões e melhorias, ' +
            'tanto in-game, quanto para nossa comunidade aqui no Discord.\n\n' +
            'Fique à vontade para sugerir o que quiser. Clique no botão abaixo para enviar a sua sugestão.'
        )
    );

    // Botão
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('suggestion:new')
                .setLabel('✍️ Enviar Sugestão')
                .setStyle(ButtonStyle.Primary)
        );

    container.addActionRowComponents(buttonRow);

    const FLAGS_V2 = (MessageFlags as unknown as Record<string, number>).IsComponentsV2 || 128;

    return {
        components: [container],
        flags: FLAGS_V2
    };
}
