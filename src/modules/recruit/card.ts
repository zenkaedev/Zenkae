import path from 'node:path';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  ComponentType,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { ids } from '../../ui/ids';

// --- Constantes e Tipos (semelhante ao seu código) ---

// Flag para ativar o modo Components V2, conforme a documentação
const COMPONENTS_V2_FLAG = 1 << 15;

const prisma = new PrismaClient();

// Mantive seu tipo de dados, está ótimo
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

// --- Funções Auxiliares (semelhante ao seu código) ---

function parseAnswers(s?: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as string[]).slice(0, 4) : [];
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
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

// --- Função Principal Refatorada ---

export async function buildApplicationCard(
  client: Client,
  app: AppRow,
  opts: { questions: string[]; dmAcceptedTemplate?: string; dmRejectedTemplate?: string },
) {
  // 1. Coleta de Dados (igual ao seu código, está perfeito)
  const guild = await client.guilds.fetch(app.guildId);
  const user = await client.users.fetch(app.userId).catch(() => null);
  const member = await guild.members.fetch(app.userId).catch(() => null);

  const avatarUrl =
    member?.displayAvatarURL({ extension: 'png', size: 128 }) ??
    user?.displayAvatarURL({ extension: 'png', size: 128 });

  const bannerUrl = user?.bannerURL({ extension: 'png', size: 512 });
  const messages = await getMessageCount(app.guildId, app.userId);
  const since = fmtDate(member?.joinedAt ?? null);
  const answers = parseAnswers(app.qAnswers);

  // 2. Construção dos Componentes (AQUI ESTÁ A MUDANÇA)

  const containerComponents = [];
  const attachments = [];

  // Componente 2.1: Media Gallery (Type 12) para o Banner
  // Conforme a documentação, para exibir imagens, usamos uma Media Gallery.
  if (bannerUrl) {
    containerComponents.push({
      type: ComponentType.MediaGallery,
      items: [{ media: { url: bannerUrl } }],
    });
  } else {
    // Fallback para o banner local
    const bannerPath = path.join('assets', 'dashboard', 'banner.png');
    const attachment = new AttachmentBuilder(bannerPath).setName('banner.png');
    attachments.push(attachment);

    containerComponents.push({
      type: ComponentType.MediaGallery,
      items: [{ media: { url: 'attachment://banner.png' } }],
    });
  }

  // Componente 2.2: Section (Type 9) para Título, Subtítulo e Avatar (Thumbnail)
  // A documentação especifica que uma Section pode ter um 'accessory', que é perfeito para o avatar.
  const title = `### ${user?.username ?? app.username} quer se juntar à guild!`;
  const subtitle = `**Atividade**: ${messages} msgs · **Membro desde**: ${since}\n**Nick**: **${app.nick}** · **Classe**: **${app.className}**`;

  const sectionComponents = [
    { type: ComponentType.TextDisplay, content: title },
    { type: ComponentType.TextDisplay, content: subtitle },
  ];

  const section: any = {
    type: ComponentType.Section,
    components: sectionComponents,
  };

  if (avatarUrl) {
    section.accessory = {
      type: ComponentType.Thumbnail,
      media: { url: avatarUrl },
    };
  }
  containerComponents.push(section);

  // Componente 2.3: Separator (Type 14) para espaçamento visual
  containerComponents.push({ type: ComponentType.Separator });

  // Componente 2.4: Text Display (Type 10) para as Perguntas e Respostas
  const qaLines = opts.questions.map((q, i) => {
    const a = answers[i] || '_—_';
    return `**${q}**: ${a}`;
  });
  containerComponents.push({
    type: ComponentType.TextDisplay,
    content: qaLines.join('\n'),
  });

  // Componente 2.5: Action Row (Type 1) com os Botões
  // Sua lógica aqui já estava correta, apenas a integramos.
  if (app.status === 'pending') {
    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.recruit.approve(app.id))
        .setLabel('Aprovar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(ids.recruit.reject(app.id))
        .setLabel('Recusar')
        .setStyle(ButtonStyle.Danger),
    );
    containerComponents.push(actions.toJSON());
  } else {
    // Lógica para card já decidido
    const label = app.status === 'approved' ? 'Aprovado' : 'Recusado';
    const style = app.status === 'approved' ? ButtonStyle.Success : ButtonStyle.Danger;
    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('noop').setLabel(label).setStyle(style).setDisabled(true),
    );
    containerComponents.push(actions.toJSON());
  }

  // 3. Montagem Final do Payload

  // Mapeia o status para a cor da barra lateral do Container
  const accentColor =
    app.status === 'approved' ? 0x57f287 : // Verde
    app.status === 'rejected' ? 0xed4245 : // Vermelho
    0x3d348b; // Roxo (Padrão)

  // O payload final tem a flag e um array de componentes de topo.
  // Neste caso, apenas um Container (Type 17) que agrupa todo o resto.
  return {
    flags: COMPONENTS_V2_FLAG,
    components: [
      {
        type: ComponentType.Container,
        accent_color: accentColor,
        components: containerComponents,
      },
    ],
    files: attachments,
  };
}