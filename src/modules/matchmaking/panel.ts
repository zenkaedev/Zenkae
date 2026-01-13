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
 * Estado temporário para criação de PT com auto-limpeza
 */
const creationState = new Map<string, {
    day?: string;
    time?: string;
    role?: string;
    timestamp: number;
}>();

// Limpar estados antigos a cada 5 minutos
setInterval(() => {
    const now = Date.now();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;

    for (const [userId, state] of creationState.entries()) {
        if (now - state.timestamp > FIFTEEN_MINUTES) {
            creationState.delete(userId);
        }
    }
}, 5 * 60 * 1000);

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
        '# 📍 **Central de Equipes**',
        '',
        'Pensamos neste espaço para facilitar a sua jornada e ajudar você a fechar aquele time perfeito, sem precisar ficar mandando várias mensagens no chat geral. Aqui a gente deixa tudo combinado com antecedência e organização.',
        '',
        '**Como funciona:** É super simples: clique no botão "Criar Nova Party", preencha o dia, o horário e o que você precisa. O bot vai criar um painel automático e os outros membros poderão ocupar as vagas de (Tank, Healer ou DPS) com apenas um clique.',
    ].join('\n');

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('matchmaking:create')
            .setLabel('➕ Criar Nova Party')
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
 * Abre fluxo de criação com selects para dia, hora e role
 */
export async function openCreationModal(inter: ButtonInteraction) {
    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    // Inicializa estado
    creationState.set(inter.user.id, { timestamp: Date.now() });

    const daySelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:day')
        .setPlaceholder('📅 Escolha o dia')
        .addOptions([
            { label: 'Segunda-feira', value: 'Segunda-feira' },
            { label: 'Terça-feira', value: 'Terça-feira' },
            { label: 'Quarta-feira', value: 'Quarta-feira' },
            { label: 'Quinta-feira', value: 'Quinta-feira' },
            { label: 'Sexta-feira', value: 'Sexta-feira' },
            { label: 'Sábado', value: 'Sábado' },
            { label: 'Domingo', value: 'Domingo' },
        ]);

    const timeOptions = [];
    for (let h = 0; h < 24; h++) {
        const hour = h.toString().padStart(2, '0');
        timeOptions.push({ label: `${hour}:00`, value: `${hour}:00` });
    }

    const timeSelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:time')
        .setPlaceholder('🕐 Escolha o horário')
        .addOptions(timeOptions);

    const roleSelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:role')
        .setPlaceholder('🎭 Sua role')
        .addOptions([
            { label: 'Tank', value: 'Tank', emoji: '🛡️' },
            { label: 'Healer', value: 'Healer', emoji: '⚕️' },
            { label: 'DPS', value: 'DPS', emoji: '⚔️' },
        ]);

    const continueBtn = new ButtonBuilder()
        .setCustomId('matchmaking:create:continue')
        .setLabel('Continuar →')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);

    await inter.editReply({
        content: '📝 **Criar Nova Party**\n\nEscolha o dia, horário e sua função para continuar:',
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(daySelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeSelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
            new ActionRowBuilder<ButtonBuilder>().addComponents(continueBtn),
        ],
    });
}

export async function handleSelectDay(inter: StringSelectMenuInteraction) {
    const userId = inter.user.id;
    const day = inter.values[0];

    let state = creationState.get(userId) || { timestamp: Date.now() };
    state.day = day;
    state.timestamp = Date.now();
    creationState.set(userId, state);

    await updateCreationMessage(inter, state);
}

export async function handleSelectTime(inter: StringSelectMenuInteraction) {
    const userId = inter.user.id;
    const time = inter.values[0];

    let state = creationState.get(userId) || { timestamp: Date.now() };
    state.time = time;
    state.timestamp = Date.now();
    creationState.set(userId, state);

    await updateCreationMessage(inter, state);
}

export async function handleSelectRole(inter: StringSelectMenuInteraction) {
    const userId = inter.user.id;
    const role = inter.values[0];

    let state = creationState.get(userId) || { timestamp: Date.now() };
    state.role = role;
    state.timestamp = Date.now();
    creationState.set(userId, state);

    await updateCreationMessage(inter, state);
}

async function updateCreationMessage(inter: StringSelectMenuInteraction, state: { day?: string; time?: string; role?: string; timestamp: number }) {
    await inter.deferUpdate();

    const allSelected = !!(state.day && state.time && state.role);
    const summary = allSelected
        ? `\n\n✅ **${state.day} às ${state.time}**\nFunção: **${state.role}**`
        : '';

    const continueBtn = new ButtonBuilder()
        .setCustomId('matchmaking:create:continue')
        .setLabel('Continuar →')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!allSelected);

    // Recriar selects para manter estado visual ou apenas atualizar botão
    // Para simplificar e evitar re-renderizar selects complexos, apenas atualizamos o botão e content.
    // Mas Discord exige componentes no update se quisermos mantê-los.
    // O ideal é rebuildar os componentes com 'default' setado, mas StringSelectMenu não tem default value como TextInput.
    // Tem que usar .setDefault(true) na option correta.

    const daySelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:day')
        .setPlaceholder(state.day || '📅 Escolha o dia')
        .addOptions([
            { label: 'Segunda-feira', value: 'Segunda-feira', default: state.day === 'Segunda-feira' },
            { label: 'Terça-feira', value: 'Terça-feira', default: state.day === 'Terça-feira' },
            { label: 'Quarta-feira', value: 'Quarta-feira', default: state.day === 'Quarta-feira' },
            { label: 'Quinta-feira', value: 'Quinta-feira', default: state.day === 'Quinta-feira' },
            { label: 'Sexta-feira', value: 'Sexta-feira', default: state.day === 'Sexta-feira' },
            { label: 'Sábado', value: 'Sábado', default: state.day === 'Sábado' },
            { label: 'Domingo', value: 'Domingo', default: state.day === 'Domingo' },
        ]);

    const timeOptions = [];
    for (let h = 0; h < 24; h++) {
        const hour = h.toString().padStart(2, '0');
        const val = `${hour}:00`;
        timeOptions.push({ label: val, value: val, default: state.time === val });
    }

    const timeSelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:time')
        .setPlaceholder(state.time || '🕐 Escolha o horário')
        .addOptions(timeOptions);

    const roleSelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:role')
        .setPlaceholder(state.role || '🎭 Sua role')
        .addOptions([
            { label: 'Tank', value: 'Tank', emoji: '🛡️', default: state.role === 'Tank' },
            { label: 'Healer', value: 'Healer', emoji: '⚕️', default: state.role === 'Healer' },
            { label: 'DPS', value: 'DPS', emoji: '⚔️', default: state.role === 'DPS' },
        ]);

    await inter.editReply({
        content: `📝 **Criar Nova Party**\n\nEscolha o dia, horário e sua função para continuar:${summary}`,
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(daySelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeSelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
            new ActionRowBuilder<ButtonBuilder>().addComponents(continueBtn),
        ],
    });
}

export async function handleContinue(inter: ButtonInteraction) {
    const state = creationState.get(inter.user.id);

    if (!state?.day || !state?.time || !state?.role) {
        await inter.reply({
            content: '❌ Selecione dia, hora e role primeiro!',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Abrir modal com campos restantes
    const modal = new ModalBuilder()
        .setCustomId('matchmaking:modal:create')
        .setTitle('Detalhes da Party');

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
                .setCustomId('description')
                .setLabel('Descrição')
                .setPlaceholder('Ex: Foco em clear rápido, traga pot')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('slots')
                .setLabel('Vagas: Tank, Healer, DPS')
                .setPlaceholder('Ex: 1, 1, 3 (Total máx: 5)')
                .setValue('1, 1, 3')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(20)
        )
    );

    await inter.showModal(modal);
}

/**
 * Processa criação da party (pós-modal)
 */
export async function handleCreation(inter: ModalSubmitInteraction) {
    if (!inter.inCachedGuild()) return;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const state = creationState.get(inter.user.id);
    if (!state || !state.day || !state.time || !state.role) {
        await inter.editReply('❌ **Sessão expirada.** Por favor, comece novamente.');
        return;
    }

    const title = inter.fields.getTextInputValue('title');
    const description = inter.fields.getTextInputValue('description');
    const slotsString = inter.fields.getTextInputValue('slots');

    const channel = inter.channel;
    if (!channel?.isTextBased()) {
        await inter.editReply('❌ Erro ao criar party.');
        return;
    }

    // Combinar datetime dos selects
    const datetime = `${state.day}, ${state.time}`;

    // Validar role (security check)
    const validRoles = ['Tank', 'Healer', 'DPS'];
    const leaderRole = validRoles.includes(state.role) ? state.role : 'DPS';

    const input: CreatePartyInput = {
        guildId: inter.guildId,
        channelId: channel.id,
        leaderId: inter.user.id,
        leaderRole: leaderRole,
        title,
        datetime,
        description,
        slotsString, // Store validará formato "1, 1, 3"
    };

    // Enviar mensagem primeiro
    // Usamos o ID da interação como messageId temporário para garantir unicidade
    const tempMessageId = `temp-${inter.id}`;
    const party = await matchmakingStore.create(input, tempMessageId);
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

    // Limpar estado
    creationState.delete(inter.user.id);

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
