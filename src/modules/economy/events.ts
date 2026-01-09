// src/modules/economy/events.ts
import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ButtonInteraction,
    type ModalSubmitInteraction,
    MessageFlags,
} from 'discord.js';
import { Context } from '../../infra/context.js';
import { zkSettings } from '../../services/zk/settings.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

export async function openNewEventModal(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('economy:events:new:modal')
        .setTitle('Criar Novo Evento');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Título do Evento')
                .setPlaceholder('Ex: Guerra de Guildas')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Descrição')
                .setPlaceholder('Descrição do evento')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('date')
                .setLabel('Data/Hora (YYYY-MM-DD HH:MM)')
                .setPlaceholder('2026-01-15 20:00')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('voice_id')
                .setLabel('ID do Canal de Voz')
                .setPlaceholder('Cole o ID do canal aqui')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('dm_message')
                .setLabel('Mensagem DM (1h antes)')
                .setPlaceholder('Ex: Prepare-se! O evento começa em 1 hora!')
                .setValue('🎮 O evento está prestes a começar! Entre no canal de voz em 1 hora!')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setRequired(true)
        ),
    );

    await interaction.showModal(modal);
}

export async function handleNewEventSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const title = interaction.fields.getTextInputValue('title').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const dateStr = interaction.fields.getTextInputValue('date').trim();
    const voiceId = interaction.fields.getTextInputValue('voice_id').trim();
    const dmMessage = interaction.fields.getTextInputValue('dm_message').trim();

    // Parse date
    const eventDate = new Date(dateStr);
    if (isNaN(eventDate.getTime())) {
        await interaction.editReply('❌ Data inválida. Use o formato: YYYY-MM-DD HH:MM');
        return;
    }

    // Validate voice channel
    const channel = interaction.guild?.channels.cache.get(voiceId);
    if (!channel || !channel.isVoiceBased()) {
        await interaction.editReply('❌ Canal de voz inválido.');
        return;
    }

    const event = await prisma.zKEvent.create({
        data: {
            guildId: interaction.guildId!,
            title,
            description,
            voiceChannelId: voiceId,
            eventDate,
            dmMessage,
            zkReward: 10, // Default
            createdBy: interaction.user.id,
        },
    });

    await interaction.editReply(
        `✅ Evento criado!\n\n` +
        `**${title}**\n` +
        `📅 ${eventDate.toLocaleString('pt-BR')}\n` +
        `🔔 Anúncio será postado 24h antes automaticamente.`
    );
}

export async function renderEventDetails(interaction: ButtonInteraction, eventId: string) {
    const event = await prisma.zKEvent.findUnique({
        where: { id: eventId },
        include: { rsvps: true },
    });

    if (!event) {
        await interaction.reply({ content: '❌ Evento não encontrado.', flags: 64 });
        return;
    }

    const currencySymbol = await zkSettings.getCurrencySymbol(interaction.guildId!);
    const date = new Date(event.eventDate).toLocaleString('pt-BR');
    const yesCount = event.rsvps.filter((r: any) => r.response === 'YES').length;
    const noCount = event.rsvps.filter((r: any) => r.response === 'NO').length;

    const embed = new EmbedBuilder()
        .setTitle(`📅 ${event.title}`)
        .setDescription(event.description)
        .setColor(0x6d28d9)
        .addFields(
            { name: '📅 Data/Hora', value: date, inline: true },
            { name: '💰 Recompensa', value: `${event.zkReward} ${currencySymbol}`, inline: true },
            { name: '✅ Confirmados', value: `${yesCount}`, inline: true },
            { name: '❌ Recusas', value: `${noCount}`, inline: true },
            { name: '🔒 RSVP', value: event.rsvpLocked ? 'Travado' : 'Aberto', inline: true },
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`economy:event:${eventId}:cancel`)
            .setLabel('Cancelar Evento')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder()
            .setCustomId('economy:events')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}

export async function handleCancelEvent(interaction: ButtonInteraction, eventId: string) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await prisma.zKEvent.delete({
        where: { id: eventId },
    });

    await interaction.editReply('✅ Evento cancelado com sucesso!');
}
