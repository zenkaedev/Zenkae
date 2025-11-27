// src/commands/poll.ts
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';

// ESM/NodeNext: imports relativos com .js
import { openCreatePollModal, buildPollPayload } from '../ui/poll/panel.js';
import { pollStore } from '../modules/poll/store.js';

type MsgLink = { guildId: string; channelId: string; messageId: string } | null;
function parseMessageLink(s: string): MsgLink {
  const m = s.match(/channels\/(\d+)\/(\d+)\/(\d+)$/);
  return m ? { guildId: m[1]!, channelId: m[2]!, messageId: m[3]! } : null;
}

// ✅ agora exportamos o BUILDER (não JSON)
export const data = new SlashCommandBuilder()
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
  .setDMPermission(false);

export async function execute(inter: ChatInputCommandInteraction) {
  if (!inter.inGuild()) {
    if (inter.isRepliable()) {
      await inter
        .reply({ content: 'Use este comando dentro de um servidor.', ephemeral: true })
        .catch(() => {});
    }
    return;
  }

  const sub = inter.options.getSubcommand(false) ?? 'create';

  if (sub === 'create') {
    try {
      const anyInter = inter as any;
      if (typeof anyInter.showModal !== 'function') {
        await inter
          .reply({
            content:
              '❌ Este ambiente não expõe `interaction.showModal`. Verifique a versão do discord.js (v14+) e intents.',
            ephemeral: true,
          })
          .catch(() => {});
        return;
      }
      await openCreatePollModal(inter as any);
      return;
    } catch (err: any) {
      const msg =
        (err?.message as string) ||
        (typeof err === 'string' ? err : 'Erro desconhecido ao abrir o modal.');
      if (inter.isRepliable()) {
        await inter
          .reply({ content: `❌ Falha ao abrir o modal:\n\`\`\`${msg}\`\`\``, ephemeral: true })
          .catch(async () => {
            if (!inter.replied && !inter.deferred) {
              await inter.followUp({ content: `❌ ${msg}`, ephemeral: true }).catch(() => {});
            }
          });
      }
      try {
        console.error('[poll:create] showModal error:', err);
      } catch {
        // ignore
      }
      return;
    }
  }

  if (sub === 'close') {
    await inter.deferReply({ ephemeral: true });

    const link = inter.options.getString('mensagem', true);
    const parsed = parseMessageLink(link);
    if (!parsed) return inter.editReply('❌ Link de mensagem inválido.');
    if (parsed.guildId !== inter.guildId)
      return inter.editReply('❌ Essa mensagem não é deste servidor.');

    const ch = await inter.guild!.channels.fetch(parsed.channelId).catch(() => null);
    if (!ch || !('isTextBased' in ch) || !(ch as any).isTextBased())
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
      await inter.followUp({ ...(payload as any), ephemeral: true } as any).catch(() => {});
    }

    return inter.editReply('✅ Enquete encerrada.');
  }

  await inter.reply({ content: 'Subcomando não reconhecido.', ephemeral: true }).catch(() => {});
}

// default + alias para compatibilidade com seu router atual
export default { data, execute };
export { execute as executePoll };
