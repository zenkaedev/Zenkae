// src/modules/recruit/card.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  ComponentType,
} from 'discord.js';
import { Context } from '../../infra/context.js';
import { ids } from '../../ui/ids.js';

const prisma = new Proxy({} as any, {
  get(target, prop) {
    return (Context.get().prisma as any)[prop];
  }
});

type AppRow = {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  nick: string;
  className: string;
  status: 'pending' | 'approved' | 'rejected';
  qAnswers: string | null;
  reason: string | null;
  messageId: string | null;
  channelId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseAnswers(s?: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as string[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}

async function getMessageCount(guildId: string, userId: string) {
  const row = await prisma.messageCounter.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  return row?.count ?? 0;
}

function fmtDate(d?: Date | null) {
  if (!d) return '—';
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function truncate(str: string, max = 4000) {
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 20)).trimEnd() + '\n…';
}

export async function buildApplicationCard(
  client: Client,
  app: AppRow,
  opts: {
    questions: string[];
    /** infos opcionais passadas pela ação (para exibir no card após decisão) */
    review?: {
      byUserId?: string; // quem aprovou/rejeitou
      at?: Date; // quando
      reason?: string; // motivo (se vier do modal)
    };
  },
) {
  // refetch garante acesso a banner/fields
  const user = await client.users.fetch(app.userId, { force: true }).catch(() => null);

  const guild = await client.guilds.fetch(app.guildId);
  // Usamos force: true para garantir que temos os dados mais recentes do membro
  const member = await guild.members.fetch({ user: app.userId, force: true }).catch(() => null);

  const avatarUrl =
    member?.displayAvatarURL({ extension: 'png', size: 128 }) ??
    user?.displayAvatarURL({ extension: 'png', size: 128 }) ??
    undefined;

  const bannerUrl = user?.bannerURL({ extension: 'gif', size: 2048 }) ?? null;

  const messages = await getMessageCount(app.guildId, app.userId);
  const since = fmtDate(member?.joinedAt ?? null);
  const answers = parseAnswers(app.qAnswers);

  const components: any[] = [];

  // 1) Media Gallery (apenas se houver banner de usuário)
  if (bannerUrl) {
    components.push({
      type: ComponentType.MediaGallery,
      items: [{ media: { url: bannerUrl } }],
    });
  }

  // 2) Section título/subtítulo + avatar
  const title = `### ${user?.username ?? app.username} quer se juntar à guild!`;
  const subtitle =
    `**Atividade**: ${messages} msgs · **Membro desde**: ${since}\n` +
    `**Nick:** ${app.nick} · **Classe:** ${app.className}`;

  const section: any = {
    type: ComponentType.Section,
    components: [
      { type: ComponentType.TextDisplay, content: title },
      { type: ComponentType.TextDisplay, content: subtitle },
    ],
  };
  if (avatarUrl) {
    section.accessory = { type: ComponentType.Thumbnail, media: { url: avatarUrl } };
  }
  components.push(section);

  components.push({ type: ComponentType.Separator });

  // 3) Q&A
  const qaLines = (opts.questions ?? []).map((q, i) => `**${q}**: ${answers[i] ?? '_—_'}`);
  if (qaLines.length) {
    components.push({
      type: ComponentType.TextDisplay,
      content: truncate(qaLines.join('\n'), 4000),
    });
  }

  // 4) Feedback de decisão (se não for pending)
  if (app.status !== 'pending') {
    const statusLabel = app.status === 'approved' ? '✅ Aprovado' : '❌ Rejeitado';
    const who = opts.review?.byUserId ? `<@${opts.review.byUserId}>` : '—';
    const when = fmtDate(opts.review?.at ?? app.updatedAt ?? new Date());
    const why = truncate((opts.review?.reason ?? app.reason ?? '—').toString(), 1000);

    components.push({ type: ComponentType.Separator });

    components.push({
      type: ComponentType.Section,
      components: [
        { type: ComponentType.TextDisplay, content: `**${statusLabel}**` },
        { type: ComponentType.TextDisplay, content: `**Por:** ${who} · **Em:** ${when}` },
        { type: ComponentType.TextDisplay, content: `**Motivo:** ${why}` },
      ],
    });
  }

  // 5) Ações
  if (app.status === 'pending') {
    components.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(ids.recruit.approve(app.id))
            .setStyle(ButtonStyle.Success)
            .setLabel('Aprovar'),
          new ButtonBuilder()
            .setCustomId(ids.recruit.reject(app.id))
            .setStyle(ButtonStyle.Danger)
            .setLabel('Recusar'),
        )
        .toJSON(),
    );
  } else {
    const label = app.status === 'approved' ? 'Aprovado' : 'Recusado';
    const style = app.status === 'approved' ? ButtonStyle.Success : ButtonStyle.Danger;
    components.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`noop:${app.id}`)
            .setLabel(label)
            .setStyle(style)
            .setDisabled(true),
        )
        .toJSON(),
    );
  }

  const accent =
    app.status === 'approved' ? 0x57f287 : app.status === 'rejected' ? 0xed4245 : 0x3d348b;

  // O objeto de retorno final é construído aqui
  const finalPayload: any = {
    flags: 1 << 15, // Components V2
    components: [{ type: ComponentType.Container, accent_color: accent, components }],
  };

  // Não há 'files' aqui, então o banner padrão não será anexado
  return finalPayload;
}
