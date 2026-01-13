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
import { renderPartyContainer } from './visual.js';
import type { CreatePartyInput } from './types.js';

// Estado temporário para armazenar seleções de dia/hora/role por usuário
const creationState = new Map<string, { day?: string; time?: string; role?: string }>();

/**
 * Publica o "Totem" - Mensagem persistente com botão para criar parties
 */
export async function publishTotem(inter: ButtonInteraction) {
    if (!inter.inCachedGuild()) return;

    // Defer imediatamente para evitar timeout
    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = inter.channel;
    if (!channel?.isTextBased()) {
        await inter.editReply('❌ Use em um canal de texto.');
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

    await inter.editReply('✅ Totem de Matchmaking publicado com sucesso!');
}

/**
 * Passo 1: Abre mensagem com selects para dia e hora
 */
export async function openCreationModal(inter: ButtonInteraction) {
    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const daySelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:day')
        .setPlaceholder('📅 Escolha o dia')
        .addOptions([
            { label: 'Segunda-feira', value: 'Segunda', emoji: '📅' },
            { label: 'Terça-feira', value: 'Terça', emoji: '📅' },
            { label: 'Quarta-feira', value: 'Quarta', emoji: '📅' },
            { label: 'Quinta-feira', value: 'Quinta', emoji: '📅' },
            { label: 'Sexta-feira', value: 'Sexta', emoji: '📅' },
            { label: 'Sábado', value: 'Sábado', emoji: '📅' },
            { label: 'Domingo', value: 'Domingo', emoji: '📅' },
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
        .setPlaceholder('🎭 Escolha sua role')
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
        content: '📝 **Criar Nova PT**\n\nPreencha as informações:',
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(daySelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeSelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
            new ActionRowBuilder<ButtonBuilder>().addComponents(continueBtn),
        ],
    });
}

/**
 * Handler para seleção de dia
 */
export async function handleSelectDay(inter: StringSelectMenuInteraction) {
    const userId = inter.user.id;
    const day = inter.values[0];

    let state = creationState.get(userId) || {};
    state.day = day;
    creationState.set(userId, state);

    await updateCreationMessage(inter, state);
}

/**
 * Handler para seleção de hora
 */
export async function handleSelectTime(inter: StringSelectMenuInteraction) {
    const userId = inter.user.id;
    const time = inter.values[0];

    let state = creationState.get(userId) || {};
    state.time = time;
    creationState.set(userId, state);

    await updateCreationMessage(inter, state);
}

/**
 * Handler para seleção de role
 */
export async function handleSelectRole(inter: StringSelectMenuInteraction) {
    const userId = inter.user.id;
    const role = inter.values[0];

    let state = creationState.get(userId) || {};
    state.role = role;
    creationState.set(userId, state);

    await updateCreationMessage(inter, state);
}

/**
 * Atualiza mensagem quando selects mudam
 */
async function updateCreationMessage(inter: StringSelectMenuInteraction, state: { day?: string; time?: string; role?: string }) {
    await inter.deferUpdate();

    const allSelected = state.day && state.time;

    const summary = allSelected
        ? `\n\n✅ **${state.day}, ${state.time}**`
        : '';

    const continueBtn = new ButtonBuilder()
        .setCustomId('matchmaking:create:continue')
        .setLabel('Continuar →')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!allSelected);

    // Recriar selects (manter valores)
    const daySelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:day')
        .setPlaceholder(state.day || '📅 Escolha o dia')
        .addOptions([
            { label: 'Segunda-feira', value: 'Segunda', emoji: '📅' },
            { label: 'Terça-feira', value: 'Terça', emoji: '📅' },
            { label: 'Quarta-feira', value: 'Quarta', emoji: '📅' },
            { label: 'Quinta-feira', value: 'Quinta', emoji: '📅' },
            { label: 'Sexta-feira', value: 'Sexta', emoji: '📅' },
            { label: 'Sábado', value: 'Sábado', emoji: '📅' },
            { label: 'Domingo', value: 'Domingo', emoji: '📅' },
        ]);

    const timeOptions = [];
    for (let h = 0; h < 24; h++) {
        const hour = h.toString().padStart(2, '0');
        timeOptions.push({ label: `${hour}:00`, value: `${hour}:00` });
    }

    const timeSelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:time')
        .setPlaceholder(state.time || '🕐 Escolha o horário')
        .addOptions(timeOptions);

    const roleSelect = new StringSelectMenuBuilder()
        .setCustomId('matchmaking:create:role')
        .setPlaceholder(state.role || '🎭 Escolha sua role')
        .addOptions([
            { label: 'Tank', value: 'Tank', emoji: '🛡️' },
            { label: 'Healer', value: 'Healer', emoji: '⚕️' },
            { label: 'DPS', value: 'DPS', emoji: '⚔️' },
        ]);

    await inter.editReply({
        content: `📝 **Criar Nova PT**\n\nPreencha as informações:${summary}`,
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(daySelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeSelect),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
            new ActionRowBuilder<ButtonBuilder>().addComponents(continueBtn),
        ],
    });
}

/**
 * Passo 2: Abre modal após selecionar dia e hora
 */
export async function handleContinue(inter: ButtonInteraction) {
    const state = creationState.get(inter.user.id);

    if (!state?.day || !state?.time || !state?.role) {
        await inter.reply({
            content: '❌ Selecione dia, hora e role primeiro!',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

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
                .setCustomId('description')
                .setLabel('Descrição Rápida')
                .setPlaceholder('Ex: Foco em clear rápido, traga pot')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ),

        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('slots')
                .setLabel('Vagas: Tank, Healer, DPS (total sempre 5)')
                .setPlaceholder('Ex: 1, 1, 3 (padrão) ou 1, 0, 4 ou 0, 1, 4')
                .setValue('1, 1, 3')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(20)
        )
    );

    await inter.showModal(modal);
}

/**
 * Processa criação final da party
 */
export async function handleCreation(inter: ModalSubmitInteraction) {
    if (!inter.inCachedGuild()) return;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    // Pegar estado salvo
    const state = creationState.get(inter.user.id);
    if (!state?.day || !state?.time || !state?.role) {
        await inter.editReply('❌ Erro: Estado perdido. Tente novamente.');
        return;
    }

    // Limpar estado
    creationState.delete(inter.user.id);

    // Ler campos do modal
    const title = inter.fields.getTextInputValue('title');
    const description = inter.fields.getTextInputValue('description');
    const slotsString = inter.fields.getTextInputValue('slots');

    // Role vem do estado, não do modal
    const role = state.role;

    const channel = inter.channel;
    if (!channel?.isTextBased()) {
        await inter.editReply('❌ Erro ao criar party.');
        return;
    }

    // Validar role
    const validRoles = ['Tank', 'Healer', 'DPS'];
    const normalizedRole = validRoles.find(r => r.toLowerCase() === role.toLowerCase());

    if (!normalizedRole) {
        await inter.editReply('❌ Role inválida. Use: Tank, Healer ou DPS');
        return;
    }

    // Validar slots (deve somar 5 total)
    const slotNumbers = slotsString.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (slotNumbers.length !== 3) {
        await inter.editReply('❌ Forneça exatamente 3 números separados por vírgula (Tank, Healer, DPS)');
        return;
    }

    const totalSlots = slotNumbers.reduce((sum, n) => sum + n, 0);
    if (totalSlots !== 5) {
        await inter.editReply(`❌ Total de vagas deve ser **5** (você colocou ${totalSlots})`);
        return;
    }

    // Combinar datetime
    const datetime = `${state.day}, ${state.time}`;

    // Criar party
    const input: CreatePartyInput = {
        guildId: inter.guildId,
        channelId: channel.id,
        leaderId: inter.user.id,
        leaderRole: normalizedRole,
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

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`matchmaking:join:${party.id}`)
            .setLabel('Entrar na PT')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`matchmaking:leave:${party.id}`)
            .setLabel('Sair da PT')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`matchmaking:cancel:${party.id}`)
            .setLabel('❌ Cancelar (Líder)')
            .setStyle(ButtonStyle.Danger)
    );

    const sent = await (channel as GuildTextBasedChannel).send({
        ...payload,
        components: [...(payload.components || []), buttons],
    });

    // Atualizar com messageId real
    await matchmakingStore.updateMessageId(party.id, sent.id);

    await inter.editReply({ content: `✅ PT criada! ${sent.url}` });
}

// ... resto dos handlers (handleJoin, handleLeave, handleKick, handleCancel)
// Mantém igual ao que já está no arquivo
const roleButtons = new ActionRowBuilder<ButtonBuilder>();

// BotÃµes por role
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

// BotÃ£o de sair
roleButtons.addComponents(
    new ButtonBuilder()
        .setCustomId(`matchmaking:leave:${partyId}`)
        .setLabel('Sair')
        .setStyle(ButtonStyle.Danger)
);

// BotÃµes de gerenciamento
const manageButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
        .setCustomId(`matchmaking:manage:${partyId}`)
        .setLabel('âš™ï¸ Gerenciar')
        .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
        .setCustomId(`matchmaking:cancel:${partyId}`)
        .setLabel('ðŸ—‘ï¸ Cancelar PT')
        .setStyle(ButtonStyle.Danger)
);

return [roleButtons, manageButtons];
}

/**
 * UsuÃ¡rio entra na party
 */
export async function handleJoin(inter: ButtonInteraction, partyId: string, role: string) {
    if (!inter.inCachedGuild()) return;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const party = await matchmakingStore.getById(partyId);
    if (!party) {
        await inter.editReply('âŒ Party nÃ£o encontrada.');
        return;
    }

    const success = await matchmakingStore.addMember(partyId, inter.user.id, role);

    if (!success) {
        await inter.editReply('âŒ NÃ£o foi possÃ­vel entrar. Vaga pode estar cheia ou vocÃª jÃ¡ estÃ¡ na party.');
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

        // Notificar lÃ­der
        try {
            const leader = await inter.client.users.fetch(party.leaderId);
            const remaining = Object.values(updatedParty.slots).reduce(
                (sum, r) => sum + (r.max - r.members.length),
                0
            );
            await leader.send(
                `ðŸš€ **Update:** <@${inter.user.id}> acabou de entrar como **${role}** na sua party "${party.title}". (Faltam ${remaining} vagas)`
            );
        } catch {
            // Ignorar se DM falhar
        }
    }

    await inter.editReply(`âœ… VocÃª entrou como **${role}**!`);
}

/**
 * UsuÃ¡rio sai da party
 */
export async function handleLeave(inter: ButtonInteraction, partyId: string) {
    if (!inter.inCachedGuild()) return;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const party = await matchmakingStore.getById(partyId);
    if (!party) {
        await inter.editReply('âŒ Party nÃ£o encontrada.');
        return;
    }

    // LÃ­der nÃ£o pode sair
    if (inter.user.id === party.leaderId) {
        await inter.editReply('âŒ O lÃ­der nÃ£o pode sair. Use "Cancelar PT" para encerrar a party.');
        return;
    }

    const success = await matchmakingStore.removeMember(partyId, inter.user.id);

    if (!success) {
        await inter.editReply('âŒ VocÃª nÃ£o estÃ¡ nesta party.');
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

    await inter.editReply('âœ… VocÃª saiu da party.');
}

/**
 * Abre menu de gerenciamento (sÃ³ lÃ­der)
 */
export async function handleManage(inter: ButtonInteraction, partyId: string) {
    if (!inter.inCachedGuild()) return;

    const party = await matchmakingStore.getById(partyId);
    if (!party) {
        await inter.reply({ content: 'âŒ Party nÃ£o encontrada.', flags: MessageFlags.Ephemeral });
        return;
    }

    // Validar lÃ­der
    if (inter.user.id !== party.leaderId) {
        await inter.reply({
            content: `â›” Apenas o lÃ­der <@${party.leaderId}> pode gerenciar esta PT.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Buscar membros (exceto lÃ­der)
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
            content: 'âš ï¸ NÃ£o hÃ¡ membros para gerenciar (apenas vocÃª estÃ¡ na party).',
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
        content: 'âš™ï¸ **Gerenciar Party** - Selecione um membro para remover:',
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

    // DM para usuÃ¡rio removido
    try {
        const kickedUser = await inter.client.users.fetch(kickUserId);
        await kickedUser.send(`âš ï¸ VocÃª foi removido da party "${party.title}" pelo lÃ­der.`);
    } catch {
        // Ignorar se DM falhar
    }

    await inter.editReply({
        content: `âœ… <@${kickUserId}> foi removido da party.`,
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
        await inter.reply({ content: 'âŒ Party nÃ£o encontrada.', flags: MessageFlags.Ephemeral });
        return;
    }

    // Validar lÃ­der
    if (inter.user.id !== party.leaderId) {
        await inter.reply({
            content: `â›” Apenas o lÃ­der <@${party.leaderId}> pode cancelar esta PT.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await matchmakingStore.delete(partyId);

    try {
        const message = await inter.channel?.messages.fetch(party.messageId);
        if (message) {
            await message.edit({
                content: `~~${message.content}~~\n\nâŒ **Esta party foi cancelada pelo lÃ­der.**`,
                components: [],
            });
        }
    } catch {
        // Ignorar erro
    }

    await inter.reply({ content: 'âœ… Party cancelada.', flags: MessageFlags.Ephemeral });
}
