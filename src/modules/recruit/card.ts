import * as D from 'discord.js';
import { Brand, buildScreen } from '../../ui/v2';
import { getMessageCount } from '../../listeners/messageCount';
import { recruitStore } from './store';

type App = {
  id: string; guildId: string; userId: string; username: string;
  nick: string; className: string; status: string;
  qAnswers?: unknown | null;
  reason?: string | null;
};

function accentByStatus(status: string) {
  if (status === 'approved') return 0x22c55e; // verde
  if (status === 'rejected') return 0xef4444; // vermelho
  return Brand.purple;                         // roxo padrão
}

export async function buildApplicationCard(
  client: D.Client, app: App, settings: { questions: string[]; dmAcceptedTemplate: string; dmRejectedTemplate: string },
) {
  const user = await client.users.fetch(app.userId, { force: true }).catch(() => null);
  const avatar = user?.displayAvatarURL({ size: 256 });
  const banner = (user as any)?.bannerURL?.({ size: 1024 }) || null;

  const msgCount = await getMessageCount(app.guildId, app.userId);
  const memberSince = (await client.guilds.fetch(app.guildId).then(g => g.members.fetch(app.userId).catch(() => null)))
    ?.joinedAt;

  const header =
    `**Título:** ${app.username} quer se juntar à guild!\n` +
    `**Atividade:** ${msgCount} mensagens · Membro desde ${memberSince ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(memberSince) : '—'}\n` +
    `**Nick:** ${app.nick}  **Classe:** ${app.className}`;

  // Q&A
  const q = Array.isArray(settings.questions) ? settings.questions : [];
  const a = Array.isArray(app.qAnswers) ? (app.qAnswers as string[]) : [];
  const qaLines = q.map((qq, i) => `**${qq}**: ${a[i] ?? '_'}`).join('\n');
  const body = qaLines || '_Sem perguntas personalizadas._';

  // Botões (apenas se pending)
  const buttons =
    app.status === 'pending'
      ? [
          new D.ButtonBuilder().setCustomId(`recruit:decision:approve:${app.id}`).setLabel('Aprovar').setStyle(D.ButtonStyle.Success),
          new D.ButtonBuilder().setCustomId(`recruit:decision:reject:${app.id}`).setLabel('Recusar').setStyle(D.ButtonStyle.Danger),
        ]
      : [];

  // Montagem do container
  const components: (D.JSONEncodable<D.APIMessageTopLevelComponent> | D.APIMessageTopLevelComponent)[] = [];

  // Banner (se houver) usando MediaGallery
  const anyD = D as any;
  const MediaGalleryBuilder = anyD.MediaGalleryBuilder || anyD.GalleryBuilder;
  const MediaGalleryItemBuilder = anyD.MediaGalleryItemBuilder || anyD.GalleryItemBuilder;
  const ContainerBuilder = anyD.ContainerBuilder;
  const TextDisplayBuilder = anyD.TextDisplayBuilder;
  const SeparatorBuilder = anyD.SeparatorBuilder;
  const SeparatorSpacingSize = anyD.SeparatorSpacingSize;
  const SectionBuilder = anyD.SectionBuilder;
  const ThumbnailBuilder = anyD.ThumbnailBuilder;

  if (!ContainerBuilder || !TextDisplayBuilder) throw new Error('Components V2 indisponível');

  const container = new ContainerBuilder().setAccentColor(accentByStatus(app.status));

  if (banner && MediaGalleryBuilder && MediaGalleryItemBuilder) {
    const gallery = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner).setDescription('Banner do usuário'));
    if (typeof (container as any).addMediaGalleryComponents === 'function') (container as any).addMediaGalleryComponents(gallery);
    else if (typeof (container as any).addGalleryComponents === 'function') (container as any).addGalleryComponents(gallery);
  }

  // Cabeçalho com thumbnail (se suportado)
  if (SectionBuilder && ThumbnailBuilder && typeof (container as any).addSectionComponents === 'function') {
    const section = new SectionBuilder()
      .setText(header)
      .setAccessory(new ThumbnailBuilder().setURL(avatar ?? ''));
    (container as any).addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
  }

  // Divisor
  if (SeparatorBuilder) {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize?.Large ?? 2).setDivider(true));
  }

  // Q&A como texto
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

  // Botões
  if (buttons.length) {
    const row = new D.ActionRowBuilder<D.ButtonBuilder>().addComponents(...buttons);
    (container as any).addActionRowComponents(row);
  }

  components.push(container);

  return {
    components,
    flags: D.MessageFlags.IsComponentsV2 as number,
  };
}
