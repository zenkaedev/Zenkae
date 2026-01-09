// src/commands/evento.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalSubmitInteraction,
    ChannelType,
    EmbedBuilder
} from 'discord.js';
import { Context } from '../infra/context.js';
import { eventRSVP } from '../services/events/rsvp.js';

const prisma = new Proxy({} as any, {
    get: (_, prop) => (Context.get().prisma as any)[prop],
});

export const data = new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Gerenciar eventos do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('criar').setDescription('Criar um novo evento')
    )
    .addSubcommand(sub =>
        sub.setName('gerenciar').setDescription('Ver e gerenciar eventos agendados')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
        await interaction.reply({ content: '❌ Este comando só funciona em servidores.', flags: 64 });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
        // Show modal
        const modal = new ModalBuilder()
            .setCustomId('event_create_modal')
            .setTitle('Criar Evento');

        const titleInput = new TextInputBuilder()
            .setCustomId('event_title')
            .setLabel('Título do Evento')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Guerra de Guildas')
            .setMaxLength(100)
            .setRequired(true);

        const descInput = new TextInputBuilder()
            .setCustomId('event_description')
            .setLabel('Descrição')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Batalha épica entre as melhores guildas!')
            .setMaxLength(1000)
            .setRequired(true);

        const dateInput = new TextInputBuilder()
            .setCustomId('event_date')
            .setLabel('Data e Hora (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('2026-01-15 20:00')
            .setRequired(true);

        const voiceInput = new TextInputBuilder()
            .setCustomId('event_voice')
            .setLabel('ID do Canal de Voz')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Cole o ID do canal de voz aqui')
            .setRequired(true);

        const dmInput = new TextInputBuilder()
            .setCustomId('event_dm')
            .setLabel('Mensagem de DM (1h antes)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Prepare suas poções! O evento começa em 1 hora!')
            .setMaxLength(500)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(voiceInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(dmInput)
        );

        await interaction.showModal(modal);

        // Handle modal submission
        try {
            const submission = await interaction.awaitModalSubmit({
                time: 300000,
                filter: (i) => i.customId === 'event_create_modal' && i.user.id === interaction.user.id
            }) as ModalSubmitInteraction;

            await submission.deferReply({ flags: 64 });

            const title = submission.fields.getTextInputValue('event_title');
            const description = submission.fields.getTextInputValue('event_description');
            const dateStr = submission.fields.getTextInputValue('event_date');
            const voiceChannelId = submission.fields.getTextInputValue('event_voice');
            const dmMessage = submission.fields.getTextInputValue('event_dm');

            // Parse date
            const eventDate = new Date(dateStr);
            if (isNaN(eventDate.getTime())) {
                await submission.editReply('❌ Data inválida. Use o formato: YYYY-MM-DD HH:MM');
                return;
            }

            // Validate voice channel
            const voiceChannel = interaction.guild.channels.cache.get(voiceChannelId);
            if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
                await submission.editReply('❌ Canal de voz inválido.');
                return;
            }

            // Create event
            const event = await prisma.zKEvent.create({
                data: {
                    guildId: interaction.guildId,
                    title,
                    description,
                    voiceChannelId,
                    eventDate,
                    dmMessage,
                    zkReward: 10, // Default reward
                    createdBy: interaction.user.id
                }
            });

            await submission.editReply(
                `✅ Evento criado com sucesso!\n\n` +
                `**${title}**\n` +
                `📅 ${eventDate.toLocaleString('pt-BR')}\n` +
                `🔔 O anúncio será postado automaticamente 24h antes.`
            );
        } catch (err) {
            console.error('[EVENTO] Error:', err);
        }
    }

    else if (subcommand === 'gerenciar') {
        await interaction.deferReply({ flags: 64 });

        // Get upcoming events
        const events = await prisma.zKEvent.findMany({
            where: {
                guildId: interaction.guildId,
                completed: false
            },
            orderBy: { eventDate: 'asc' }
        });

        if (events.length === 0) {
            await interaction.editReply('📭 Nenhum evento agendado.');
            return;
        }

        // Build embeds
        const embeds: EmbedBuilder[] = [];

        for (const event of events) {
            const counts = await eventRSVP.getCounts(event.id);
            const dateStr = new Date(event.eventDate).toLocaleString('pt-BR');

            const embed = new EmbedBuilder()
                .setTitle(event.title)
                .setDescription(event.description)
                .setColor(0x6d28d9)
                .addFields(
                    { name: '📅 Data', value: dateStr, inline: true },
                    { name: '💰 Recompensa', value: `${event.zkReward} ZK`, inline: true },
                    { name: '✅ Confirmados', value: `${counts.yes}`, inline: true },
                    { name: '❌ Recusas', value: `${counts.no}`, inline: true }
                )
                .setFooter({ text: `ID: ${event.id}` });

            embeds.push(embed);
        }

        await interaction.editReply({
            content: `**Eventos Agendados (${events.length})**`,
            embeds: embeds.slice(0, 5) // Max 5 embeds
        });
    }
}
