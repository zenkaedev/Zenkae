// src/modules/matchmaking/panel.ts

import {
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    type ButtonInteraction,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
    type GuildTextBasedChannel,
    MessageFlags,
} from 'discord.js';

import { matchmakingStore } from './store.js';
import { renderPartyContainer, getRoleEmoji } from './visual.js';
import type { CreatePartyInput } from './types.js';

/**
 * Publica o "Totem" - Mensagem persistente com botão para criar parties
 */
export async function publishTotem(inter: ButtonInteraction) {
    if (!inter.inCachedGuild()) return;

    // Defer imediatamente para evitar timeout
    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = inter.channel;
    if (!channel?.isTextBased()) {
        await inter.editReply({ content: '❌ Use em um canal de texto.' });
        return;
    }

    const content = [
        '# 📍 **MATCHMAKING HUB**',
        '',
        '> Monte sua party para dungeons, raids e atividades!',
        '> Clique no botão abaixo para criar uma nova party.',
    ].join('\n');

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('matchmaking:create')
            .setLabel('➕ Criar Nova PT')
            .setStyle(ButtonStyle.Primary)
    );

    const sent = await (channel as GuildTextBasedChannel).send({
        content,
        components: [button],
    });

    await matchmakingStore.saveTotem(inter.guildId, channel.id, sent.id);

    await inter.editReply({
        content: '✅ Totem de Matchmaking publicado com sucesso!',
    });
}

/**
 * Abre modal de criação de party
 */
export async function openCreationModal(inter: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('matchmaking:modal:create')
        .setTitle('Criar Nova PT');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Nome da Atividade')
                .setPlaceholder('Ex: Torre sem Fim - 100F')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('day')
                .setLabel('Dia da Semana')
                .setPlaceholder('Segunda, Terça, Quarta, Quinta, Sexta, Sábado, Domingo')
                .setValue('Sexta')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(15)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('time')
                .setLabel('Horário (formato 24h)')
                .setPlaceholder('00:00 até 23:00 - Ex: 20:00')
                .setValue('20:00')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(5)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Descrição Rápida')
                .setPlaceholder('Ex: Foco em clear rápido, traga pot')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('role')
                .setLabel('Sua Role')
                .setPlaceholder('Tank, Healer ou DPS')
                .setValue('DPS')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(10)
        )
    );

    // Nota: Campo 'slots' será adicionado em follow-up ou teremos que fazer 2-step flow
    // Discord limita modais a 5 ActionRows, então precisamos decidir:

    await inter.showModal(modal);
}

/**
 * Processa criação da party
 */
export async function handleCreation(inter: ModalSubmitInteraction) {
    if (!inter.inCachedGuild()) return;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const title = inter.fields.getTextInputValue('title');
    const datetime = inter.fields.getTextInputValue('datetime');
    const description = inter.fields.getTextInputValue('description');
    const slotsString = inter.fields.getTextInputValue('slots');

    const channel = inter.channel;
    if (!channel?.isTextBased()) {
        await inter.editReply('❌ Erro ao criar party.');
        return;
    }

    // Criar party no DB (temporário sem messageId)
    const input: CreatePartyInput = {
        guildId: inter.guildId,
        channelId: channel.id,
        leaderId: inter.user.id,
        title,
        datetime,
        description,
        slotsString,
    };

    // Enviar mensagem primeiro
    const party = await matchmakingStore.create(input, 'temp');
    const payload = renderPartyContainer({
        title: party.title,
        datetime: party.datetime,
        description: party.description,
        leaderId: party.leaderId,
        slots: party.slots,
    });

    const buttons = buildPartyButtons(party.id, party.slots);

    const sent = await (channel as GuildTextBasedChannel).send({
        ...payload,
        components: [...(payload.components || []), ...buttons],
    });

    // Atualizar com messageId real
    await matchmakingStore.updateMessageId(party.id, sent.id);

    try {
        // Notificar líder
        const leader = await inter.client.users.fetch(inter.user.id);
        await leader.send(`🚀 Sua party **${title}** foi criada com sucesso!`);
    } catch {
        // Ignorar se DM falhar
    }

    await inter.editReply('✅ Party criada com sucesso!');
}

/**
 * Constrói botões da party
 */
function buildPartyButtons(partyId: string, slots: any): ActionRowBuilder<ButtonBuilder>[] {
    const roleButtons = new ActionRowBuilder<ButtonBuilder>();

    // Botões por role
    for (const roleName of Object.keys(slots)) {
        const emoji = getRoleEmoji(roleName);
        roleButtons.addComponents(
            new ButtonBuilder()
                .setCustomId(`matchmaking:join:${partyId}:${roleName}`)
                .setLabel(roleName)
                .setEmoji(emoji)
                .setStyle(ButtonStyle.Secondary)
        );
    }

    // Botão de sair
    roleButtons.addComponents(
        new ButtonBuilder()
            .setCustomId(`matchmaking:leave:${partyId}`)
            .setLabel('Sair')
            .setStyle(ButtonStyle.Danger)
    );

    // Botões de gerenciamento
    const manageButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`matchmaking:manage:${partyId}`)
            .setLabel('⚙️ Gerenciar')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`matchmaking:cancel:${partyId}`)
            .setLabel('🗑️ Cancelar PT')
            .setStyle(ButtonStyle.Danger)
    );

    return [roleButtons, manageButtons];
}

/**
 * Usuário entra na party
 */
export async function handleJoin(inter: ButtonInteraction, partyId: string, role: string) {
    if (!inter.inCachedGuild()) return;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const party = await matchmakingStore.getById(partyId);
    if (!party) {
        await inter.editReply('❌ Party não encontrada.');
        return;
    }

    const success = await matchmakingStore.addMember(partyId, inter.user.id, role);

    if (!success) {
        await inter.editReply('❌ Não foi possível entrar. Vaga pode estar cheia ou você já está na party.');
        return;
    }

    // Atualizar mensagem
    const updatedParty = await matchmakingStore.getById(partyId);
    if (updatedParty) {
        const payload = renderPartyContainer({
            title: updatedParty.title,
            datetime: updatedParty.datetime,
            description: updatedParty.description,
            leaderId: updatedParty.leaderId,
            slots: updatedParty.slots,
        });

        const buttons = buildPartyButtons(updatedParty.id, updatedParty.slots);

        try {
            const message = await inter.channel?.messages.fetch(party.messageId);
            if (message) {
                await message.edit({
                    ...payload,
                    components: [...(payload.components || []), ...buttons]
                });
            }
        } catch {
            // Ignorar erro
        }

        // Notificar líder
        try {
            const leader = await inter.client.users.fetch(party.leaderId);
            const remaining = Object.values(updatedParty.slots).reduce(
                (sum, r) => sum + (r.max - r.members.length),
                0
            );
            await leader.send(
                `🚀 **Update:** <@${inter.user.id}> acabou de entrar como **${role}** na sua party "${party.title}". (Faltam ${remaining} vagas)`
            );
        } catch {
            // Ignorar se DM falhar
        }
    }

    await inter.editReply(`✅ Você entrou como **${role}**!`);
}

/**
 * Usuário sai da party
 */
export async function handleLeave(inter: ButtonInteraction, partyId: string) {
    if (!inter.inCachedGuild()) return;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const party = await matchmakingStore.getById(partyId);
    if (!party) {
        await inter.editReply('❌ Party não encontrada.');
        return;
    }

    // Líder não pode sair
    if (inter.user.id === party.leaderId) {
        await inter.editReply('❌ O líder não pode sair. Use "Cancelar PT" para encerrar a party.');
        return;
    }

    const success = await matchmakingStore.removeMember(partyId, inter.user.id);

    if (!success) {
        await inter.editReply('❌ Você não está nesta party.');
        return;
    }

    // Atualizar mensagem
    const updatedParty = await matchmakingStore.getById(partyId);
    if (updatedParty) {
        const payload = renderPartyContainer({
            title: updatedParty.title,
            datetime: updatedParty.datetime,
            description: updatedParty.description,
            leaderId: updatedParty.leaderId,
            slots: updatedParty.slots,
        });

        const buttons = buildPartyButtons(updatedParty.id, updatedParty.slots);

        try {
            const message = await inter.channel?.messages.fetch(party.messageId);
            if (message) {
                await message.edit({
                    ...payload,
                    components: [...(payload.components || []), ...buttons]
                });
            }
        } catch {
            // Ignorar erro
        }
    }

    await inter.editReply('✅ Você saiu da party.');
}

/**
 * Abre menu de gerenciamento (só líder)
 */
export async function handleManage(inter: ButtonInteraction, partyId: string) {
    if (!inter.inCachedGuild()) return;

    const party = await matchmakingStore.getById(partyId);
    if (!party) {
        await inter.reply({ content: '❌ Party não encontrada.', flags: MessageFlags.Ephemeral });
        return;
    }

    // Validar líder
    if (inter.user.id !== party.leaderId) {
        await inter.reply({
            content: `⛔ Apenas o líder <@${party.leaderId}> pode gerenciar esta PT.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Buscar membros (exceto líder)
    const members: string[] = [];
    for (const roleData of Object.values(party.slots)) {
        for (const memberId of roleData.members) {
            if (memberId !== party.leaderId && !members.includes(memberId)) {
                members.push(memberId);
            }
        }
    }

    if (members.length === 0) {
        await inter.reply({
            content: '⚠️ Não há membros para gerenciar (apenas você está na party).',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Select menu
    const select = new StringSelectMenuBuilder()
        .setCustomId(`matchmaking:kick:${partyId}`)
        .setPlaceholder('Selecione um membro para remover');

    for (const memberId of members) {
        select.addOptions({
            label: `Remover ${memberId}`,
            value: memberId,
            description: 'Kick da party',
        });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await inter.reply({
        content: '⚙️ **Gerenciar Party** - Selecione um membro para remover:',
        components: [row],
        flags: MessageFlags.Ephemeral,
    });
}

/**
 * Kick de membro
 */
export async function handleKick(inter: StringSelectMenuInteraction, partyId: string) {
    if (!inter.inCachedGuild()) return;

    await inter.deferUpdate();

    const kickUserId = inter.values[0];
    const party = await matchmakingStore.getById(partyId);

    if (!party) return;

    await matchmakingStore.removeMember(partyId, kickUserId);

    // Atualizar mensagem
    const updatedParty = await matchmakingStore.getById(partyId);
    if (updatedParty) {
        const payload = renderPartyContainer({
            title: updatedParty.title,
            datetime: updatedParty.datetime,
            description: updatedParty.description,
            leaderId: updatedParty.leaderId,
            slots: updatedParty.slots,
        });

        const buttons = buildPartyButtons(updatedParty.id, updatedParty.slots);

        try {
            const message = await inter.channel?.messages.fetch(party.messageId);
            if (message) {
                await message.edit({
                    ...payload,
                    components: [...(payload.components || []), ...buttons]
                });
            }
        } catch {
            // Ignorar erro
        }
    }

    // DM para usuário removido
    try {
        const kickedUser = await inter.client.users.fetch(kickUserId);
        await kickedUser.send(`⚠️ Você foi removido da party "${party.title}" pelo líder.`);
    } catch {
        // Ignorar se DM falhar
    }

    await inter.editReply({
        content: `✅ <@${kickUserId}> foi removido da party.`,
        components: [],
    });
}

/**
 * Cancelar party
 */
export async function handleCancel(inter: ButtonInteraction, partyId: string) {
    if (!inter.inCachedGuild()) return;

    const party = await matchmakingStore.getById(partyId);
    if (!party) {
        await inter.reply({ content: '❌ Party não encontrada.', flags: MessageFlags.Ephemeral });
        return;
    }

    // Validar líder
    if (inter.user.id !== party.leaderId) {
        await inter.reply({
            content: `⛔ Apenas o líder <@${party.leaderId}> pode cancelar esta PT.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await matchmakingStore.delete(partyId);

    try {
        const message = await inter.channel?.messages.fetch(party.messageId);
        if (message) {
            await message.edit({
                content: `~~${message.content}~~\n\n❌ **Esta party foi cancelada pelo líder.**`,
                components: [],
            });
        }
    } catch {
        // Ignorar erro
    }

    await inter.reply({ content: '✅ Party cancelada.', flags: MessageFlags.Ephemeral });
}
