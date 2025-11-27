// src/modules/recruit/card.ts
// Zenkae — Recruit Application Card (Components V2 only, sem embeds)
// Regra: se o usuário NÃO tiver banner → NÃO exibir imagem.
// Layout: Banner (opcional) → Cabeçalho (título + infos + avatar à direita)
//         → Separador → "Formulário" (Q/A) → Separador → Status → Botões

import type { Client, User } from 'discord.js';
import { ButtonStyle, MessageFlags } from 'discord.js';
// Importa a função para buscar a contagem de mensagens
import { getMessageCount } from '../../listeners/messageCount.js';

// Component type ids (Components V2)
const V2 = {
  ActionRow: 1,
  Button: 2,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  File: 13,
  Separator: 14,
  Container: 17,
} as const;

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface BuildExtras {
  questions?: string[];
  dmAcceptedTemplate?: string | null;
  dmRejectedTemplate?: string | null;
  locale?: string; // ex.: 'pt-BR'
  accentColor?: number; // RGB ex.: 0x3D348B
}

type MaybeDate = Date | string | number | null | undefined;

// Helper para parsear JSON de forma segura
function parseJsonArray(jsonString: string | null | undefined): string[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Constrói o cartão de candidatura usando Components V2.
 * - Se houver banner do usuário → adiciona Media Gallery no topo
 * - Se NÃO houver → não adiciona mídia (sem fallback roxo)
 * - Avatar do candidato no HEAD (thumbnail à direita)
 */
export async function buildApplicationCard(client: Client, app: any, extras?: BuildExtras) {
  // --------- dados básicos ---------
  const guildId: string | null = app?.guildId ?? null;
  const userId: string | null = app?.userId ?? null;
  const nick: string = (app?.nick ?? '').toString();
  const className: string = (app?.className ?? '').toString();
  const status: ApplicationStatus = (app?.status ?? 'pending') as ApplicationStatus; // quem moderou (quando aprovado/recusado)

  const moderatorId: string | null = app?.moderatorId ?? app?.staffId ?? null;
  const moderatorNameFromDb: string | null = app?.moderatorName ?? null;
  const reason: string | null = (app?.reason ?? null) || null; // timestamps

  const createdAt: MaybeDate = app?.createdAt ?? null;
  const updatedAt: MaybeDate = app?.updatedAt ?? createdAt ?? null;

  const locale = extras?.locale ?? 'pt-BR'; // --------- fetch usuário e urls ---------

  const user = userId ? await safeFetchUser(client, userId) : null;
  const displayName = user?.globalName ?? user?.username ?? app?.username ?? 'Usuário';
  const avatarUrl = user?.displayAvatarURL({ size: 256 });
  const bannerUrl = user?.bannerURL?.({ size: 2048 }) ?? null;

  // Busca a contagem de atividade diretamente aqui.
  const activityCount = guildId && userId ? await getMessageCount(guildId, userId) : 0; // --------- Seção principal com todas as infos e avatar ---------

  // Combina Nick, Classe e Atividade em um único componente de texto
  // para respeitar o limite de 3 componentes de texto por Seção da API do Discord.
  const infoLines: string[] = [
    `**Nick:** ${escapeMd(nick || '—')}`,
    `**Classe:** ${escapeMd(className || '—')}`,
  ];

  if (typeof activityCount === 'number') {
    infoLines.push(`**Atividade no servidor:** ${activityCount} msgs`);
  }

  const mainSectionComponents = [
    { type: V2.TextDisplay, content: `# ${escapeMd(`Candidatura de ${displayName}`)}` },
    { type: V2.TextDisplay, content: infoLines.join('\n') },
  ];

  const mainSection: any = {
    type: V2.Section,
    components: mainSectionComponents,
    accessory: avatarUrl
      ? {
          type: V2.Thumbnail,
          media: { url: avatarUrl },
          description: 'Avatar do candidato',
        }
      : undefined,
  }; // --------- seção Formulário (Q/A) ---------

  const qaComponents: any[] = [];
  const questions: string[] = (extras?.questions ?? [])
    .map((q) => (q ?? '').toString())
    .filter((q) => q.trim().length > 0)
    .slice(0, 4);

  const answers: string[] = parseJsonArray(app?.qAnswers);

  // Exibe a seção de formulário se houver perguntas, mesmo sem respostas.
  if (questions.length > 0) {
    qaComponents.push({ type: V2.TextDisplay, content: `## Formulário` });
    for (let i = 0; i < questions.length; i++) {
      const rawQ = questions[i] ?? '';
      const rawA = answers[i] ?? '—'; // Fallback para resposta vazia

      const label = escapeMd(rawQ);
      const value = escapeMd(rawA);

      qaComponents.push({
        type: V2.TextDisplay,
        content: `**${label}:** ${value}`,
      });
    }
  } // --------- status ---------

  const statusText = await renderStatus({
    client,
    status,
    moderatorId,
    moderatorNameFromDb: app?.moderatorName ?? null,
    timestamp: updatedAt,
    reason,
    locale,
    moderatedByDisplay: app?.moderatedByDisplay,
    moderatedAt: app?.moderatedAt,
  });

  // --------- botões ---------
  const buttonsRow = {
    type: V2.ActionRow,
    components: [
      {
        type: V2.Button,
        style: ButtonStyle.Success,
        custom_id: `recruit:decision:approve:${app.id}`,
        label: 'Aprovar',
      },
      {
        type: V2.Button,
        style: ButtonStyle.Danger,
        custom_id: `recruit:decision:reject:${app.id}`,
        label: 'Recusar',
      },
    ],
  }; // --------- montagem do Container ---------

  const containerChildren: any[] = []; // banner (topo) — somente se houver

  if (bannerUrl) {
    containerChildren.push({
      type: V2.MediaGallery,
      items: [{ media: { url: bannerUrl } }],
    });
  } // Adiciona a seção principal unificada

  containerChildren.push(mainSection); // separador

  containerChildren.push({ type: V2.Separator, divider: true, spacing: 1 }); // formulário

  if (qaComponents.length) {
    containerChildren.push(...qaComponents);
    containerChildren.push({ type: V2.Separator, divider: true, spacing: 1 });
  } // status

  if (statusText) {
    containerChildren.push({ type: V2.TextDisplay, content: statusText });
  }

  // [ALTERAÇÃO] Define a cor do container com base no status da aplicação.
  const accentColor =
    status === 'approved'
      ? 0x57f287 // Verde para aprovado
      : status === 'rejected'
        ? 0xed4245 // Vermelho para recusado
        : (extras?.accentColor ?? 0x3d348b); // Roxo padrão para pendente

  const components: any[] = [
    {
      type: V2.Container,
      accent_color: accentColor,
      components: containerChildren,
    },
  ];

  // Adiciona a fileira de botões apenas se o status for 'pending'
  if (status === 'pending') {
    components.push(buttonsRow);
  } // payload final V2

  return {
    flags: MessageFlags.IsComponentsV2, // 1 << 15
    components,
  } as const;
}

// ---------- helpers ----------

async function safeFetchUser(client: Client, userId: string): Promise<User | null> {
  try {
    const u = await client.users.fetch(userId, { force: true });
    return u ?? null;
  } catch {
    return null;
  }
}

function escapeMd(input: string): string {
  return (input ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|');
}

function formatDate(ts: MaybeDate, locale = 'pt-BR'): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

async function renderStatus(opts: {
  client: Client;
  status: ApplicationStatus;
  moderatorId: string | null;
  moderatorNameFromDb: string | null;
  timestamp: MaybeDate;
  reason: string | null;
  locale: string;
  moderatedByDisplay?: string | null;
  moderatedAt?: Date | null;
}): Promise<string> {
  const {
    client,
    status,
    moderatorId,
    moderatorNameFromDb,
    timestamp,
    reason,
    locale,
    moderatedByDisplay,
    moderatedAt,
  } = opts;

  if (status === 'pending') {
    return '🟡 **Status:** Em análise pela staff';
  }

  // tenta resolver displayName do moderador
  let modName = moderatedByDisplay ?? moderatorNameFromDb ?? null;
  if (!modName && moderatorId) {
    const mod = await safeFetchUser(client, moderatorId);
    modName = mod?.globalName ?? mod?.username ?? null;
  }
  const who = escapeMd(modName ?? 'Staff');
  const when = formatDate(moderatedAt ?? timestamp, locale);
  const whenTxt = when ? ` em ${when}` : '';

  if (status === 'approved') {
    return `🟢 **Status:** Aprovado por ${who}${whenTxt}`;
  }

  // rejected
  const reasonTxt = reason ? ` pelo motivo: ${escapeMd(reason)}` : '';
  return `🔴 **Status:** Recusado por ${who}${whenTxt}${reasonTxt}`;
}
