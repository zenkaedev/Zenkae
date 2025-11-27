// src/commands/poll.ts
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from 'discord.js';

// ESM/NodeNext: imports relativos com .js
import { pollStore } from '../modules/poll/store.js';
import { buildPollPayload } from '../modules/poll/panel.js';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Gerencia enquetes.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand((s) =>
    s.setName('new').setDescription('Cria uma nova enquete (abre modal).'),
  )
  .addSubcommand((s) =>
    s
      .setName('close')
      .setDescription('Encerra uma enquete existente.')
      .addStringOption((o) =>
        o
          .setName('mensagem')
          .setDescription('Link da mensagem da enquete')
          .setRequired(true),
      ),
  );

export async function execute(inter: ChatInputCommandInteraction) {
  if (!inter.inGuild()) {
    if (inter.isRepliable()) {
      await inter
        .reply({ content: 'Use este comando dentro de um servidor.', flags: MessageFlags.Ephemeral })
        .catch(() => { });
    }
    return;
  }

  const sub = inter.options.getSubcommand();

  if (sub === 'new') {
    // Modal
    const modal = new ModalBuilder()
      .setCustomId('poll:new:modal')
      .setTitle('Nova Enquete');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Título da Enquete')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true);

    const optionsInput = new TextInputBuilder()
      .setCustomId('options')
      .setLabel('Opções (uma por linha)')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(true);

    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Duração (ex: 24h, 30m) - Opcional')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(optionsInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
    );

    try {
      await inter.showModal(modal);
    } catch (err) {
      const msg =
        (err as any)?.message ||
        (typeof err === 'string' ? err : 'Erro desconhecido ao abrir o modal.');
      if (inter.isRepliable()) {
        await inter
          .reply({ content: `❌ Falha ao abrir o modal:\n\`\`\`${msg}\`\`\``, flags: MessageFlags.Ephemeral })
          .catch(async () => {
            if (!inter.replied && !inter.deferred) {
              await inter.followUp({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral }).catch(() => { });
            }
          });
      }
    }
    return;
  }

  if (sub === 'close') {
    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const link = inter.options.getString('mensagem', true);
    const parsed = parseMessageLink(link);

    if (!parsed || parsed.guildId !== inter.guildId) {
      await inter.editReply('❌ Link inválido ou de outro servidor.');
      return;
    }

    const channel = await inter.client.channels.fetch(parsed.channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      await inter.editReply('❌ Canal não encontrado.');
      return;
    }

    const msg = await channel.messages.fetch(parsed.messageId).catch(() => null);
    if (!msg) {
      await inter.editReply('❌ Mensagem não encontrada.');
      return;
    }

    // Verificar se é enquete
    const pollId = await pollStore.getIdByMessage(msg.id);
    if (!pollId) {
      await inter.editReply('❌ Essa mensagem não parece ser uma enquete ativa.');
      return;
    }

    // Encerrar
    await pollStore.close(pollId);
    const poll = await pollStore.get(pollId);
    if (!poll) {
      await inter.editReply('❌ Erro ao recuperar dados da enquete.');
      return;
    }

    const payload = buildPollPayload(poll);
    try {
      await msg.edit(payload as any);
    } catch {
      await inter.followUp({ ...(payload as any), flags: MessageFlags.Ephemeral } as any).catch(() => { });
    }

    return inter.editReply('✅ Enquete encerrada.');
  }

  await inter.reply({ content: 'Subcomando não reconhecido.', flags: MessageFlags.Ephemeral }).catch(() => { });
}

function parseMessageLink(link: string) {
  const regex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const match = link.match(regex);
  if (!match) return null;
  return { guildId: match[1], channelId: match[2], messageId: match[3] };
}
