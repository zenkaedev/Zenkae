// src/commands/poll.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { openCreatePollModal, buildPollPayload } from '../ui/poll/panel';
import { pollStore } from '../modules/poll/store';

type MsgLink = { guildId: string; channelId: string; messageId: string } | null;
function parseMessageLink(s: string): MsgLink {
  // formatos aceitos:
  // https://discord.com/channels/<guild>/<channel>/<message>
  // discord://-/channels/<guild>/<channel>/<message>
  const m = s.match(/channels\/(\d+)\/(\d+)\/(\d+)$/);
  return m ? { guildId: m[1]!, channelId: m[2]!, messageId: m[3]! } : null;
}

export const pollCommandData = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Criar e gerenciar enquetes')
  .addSubcommand((sc) =>
    sc.setName('create').setDescription('Criar uma nova enquete'),
  )
  .addSubcommand((sc) =>
    sc
      .setName('close')
      .setDescription('Encerrar uma enquete pela mensagem')
      .addStringOption((o) =>
        o
          .setName('mensagem')
          .setDescription('Link da mensagem da enquete')
          .setRequired(true),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

export async function executePoll(inter: ChatInputCommandInteraction) {
  if (!inter.inCachedGuild()) return;

  const sub = inter.options.getSubcommand(true);

  // /poll create
  if (sub === 'create') {
    return openCreatePollModal(inter as any);
  }

  // /poll close mensagem:<link>
  if (sub === 'close') {
    await inter.deferReply({ ephemeral: true });

    const link = inter.options.getString('mensagem', true);
    const parsed = parseMessageLink(link);
    if (!parsed) return inter.editReply('❌ Link de mensagem inválido.');
    if (parsed.guildId !== inter.guildId)
      return inter.editReply('❌ Essa mensagem não é deste servidor.');

    const ch = await inter.guild!.channels
      .fetch(parsed.channelId) // <- agora é string garantido
      .catch(() => null);
    if (!ch || !ch.isTextBased())
      return inter.editReply('❌ Canal não encontrado ou não é de texto.');

    const msg = await (ch as any).messages.fetch(parsed.messageId).catch(() => null);
    if (!msg) return inter.editReply('❌ Mensagem não encontrada.');

    // extrai pollId de um botão de voto: poll:vote:<pollId>:<idx>
    const comps = msg.components?.flatMap((r: any) => r.components || []) || [];
    const btn = comps.find(
      (c: any) => typeof c.customId === 'string' && c.customId.startsWith('poll:vote:'),
    );
    if (!btn) return inter.editReply('❌ Não identifiquei uma enquete nessa mensagem.');

    const parts = (btn.customId as string).split(':');
    const pollId = parts[2];
    if (!pollId) return inter.editReply('❌ ID da enquete não encontrado.');

    const poll = await pollStore.getById(pollId);
    if (!poll) return inter.editReply('❌ Enquete não encontrada.');

    const now = new Date();
    // garante que o método exista
    if (typeof (pollStore as any).updateEndsAt === 'function') {
      await (pollStore as any).updateEndsAt(pollId, now);
    }
    (poll as any).endsAt = now;

    const counts = await pollStore.countVotes(pollId);
    const payload = buildPollPayload(poll as any, counts);

    try {
      await msg.edit(payload as any);
    } catch {
      // se não conseguir editar (permissões), pelo menos responde com os resultados
      await inter.followUp({ ...(payload as any), flags: 1 << 6 } as any).catch(() => {});
    }

    return inter.editReply('✅ Enquete encerrada.');
  }
}
