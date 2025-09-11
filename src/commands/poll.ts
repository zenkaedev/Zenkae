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
  const m = s.match(/channels\/(\d+)\/(\d+)\/(\d+)$/);
  return m ? { guildId: m[1]!, channelId: m[2]!, messageId: m[3]! } : null;
}

export const pollCommandData = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Criar e gerenciar enquetes')
  .addSubcommand((sc) => sc.setName('create').setDescription('Criar uma nova enquete'))
  .addSubcommand((sc) =>
    sc
      .setName('close')
      .setDescription('Encerrar uma enquete pela mensagem')
      .addStringOption((o) =>
        o.setName('mensagem').setDescription('Link da mensagem da enquete').setRequired(true),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

export async function executePoll(inter: ChatInputCommandInteraction) {
  // Guard: responder efêmero se não estiver em guild
  if (!inter.inGuild()) {
    if (inter.isRepliable()) {
      await inter
        .reply({ content: 'Use este comando dentro de um servidor.', flags: 64 })
        .catch(() => {});
    }
    return;
  }

  // Subcommand robusto (não quebra se o Discord não enviar o sub explicitamente)
  const sub = inter.options.getSubcommand(false) ?? 'create';

  // /poll create
  if (sub === 'create') {
    // DIAGNÓSTICO: validar API disponível e abrir modal sem nenhum await pesado
    try {
      // Algumas builds/ambientes transpõem tipos; garantimos que a função existe
      const anyInter = inter as any;
      if (typeof anyInter.showModal !== 'function') {
        await inter
          .reply({
            content:
              '❌ Este ambiente não expõe `interaction.showModal`. Verifique versão do discord.js (v14+) e intents.',
            flags: 64,
          })
          .catch(() => {});
        return;
      }

      // Abrir modal imediatamente
      await openCreatePollModal(inter as any);
      return;
    } catch (err: any) {
      // Tornar o erro visível pra depurar (efêmero, sem stack poluída ao usuário)
      const msg =
        (err?.message as string) ||
        (typeof err === 'string' ? err : 'Erro desconhecido ao abrir o modal.');
      if (inter.isRepliable()) {
        await inter
          .reply({ content: `❌ Falha ao abrir o modal:\n\`\`\`${msg}\`\`\``, flags: 64 })
          .catch(async () => {
            if (!inter.replied && !inter.deferred) {
              await inter.followUp({ content: `❌ ${msg}`, flags: 64 }).catch(() => {});
            }
          });
      }
      // Log no console para inspeção no runner
      try {
        // eslint-disable-next-line no-console
        console.error('[poll:create] showModal error:', err);
      } catch {}
      return;
    }
  }

  // /poll close mensagem:<link>
  if (sub === 'close') {
    await inter.deferReply({ ephemeral: true });

    const link = inter.options.getString('mensagem', true);
    const parsed = parseMessageLink(link);
    if (!parsed) return inter.editReply('❌ Link de mensagem inválido.');
    if (parsed.guildId !== inter.guildId) return inter.editReply('❌ Essa mensagem não é deste servidor.');

    const ch = await inter.guild!.channels.fetch(parsed.channelId).catch(() => null);
    if (!ch || !('isTextBased' in ch) || !ch.isTextBased())
      return inter.editReply('❌ Canal não encontrado ou não é de texto.');

    const msg = await (ch as any).messages.fetch(parsed.messageId).catch(() => null);
    if (!msg) return inter.editReply('❌ Mensagem não encontrada.');

    // extrai pollId: poll:vote:<pollId>:<idx>
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
    if (typeof (pollStore as any).updateEndsAt === 'function') {
      await (pollStore as any).updateEndsAt(pollId, now);
    }
    (poll as any).endsAt = now;

    const counts = await pollStore.countVotes(pollId);
    const payload = buildPollPayload(poll as any, counts);

    try {
      await msg.edit(payload as any);
    } catch {
      await inter.followUp({ ...(payload as any), flags: 1 << 6 } as any).catch(() => {});
    }

    return inter.editReply('✅ Enquete encerrada.');
  }

  // fallback
  await inter.reply({ content: 'Subcomando não reconhecido.', flags: 64 }).catch(() => {});
}

export default { data: pollCommandData, execute: executePoll };
