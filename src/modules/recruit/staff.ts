import { StringSelectMenuBuilder } from 'discord.js';
import { recruitStore, type ApplicationStatus } from './store';
import { buildScreen } from '../../ui/v2';
import { ids } from '../../ui/ids';

export type FilterKind = 'all' | 'pending' | 'approved' | 'rejected';

const LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pendentes',
  approved: 'Aprovadas',
  rejected: 'Recusadas',
};

function fmtItem(u: { username: string; nick: string; className: string }) {
  // • Nick — Classe (_@username_)
  return `• **${u.nick}** — ${u.className} (_@${u.username}_)`;
}

async function buildRecruitList(guildId: string, filter: FilterKind) {
  const statuses: ApplicationStatus[] =
    filter === 'all'
      ? (['pending', 'approved', 'rejected'] as ApplicationStatus[])
      : ([filter] as ApplicationStatus[]);

  const parts: string[] = [];
  for (const st of statuses) {
    const apps = await recruitStore.listByStatus(guildId, st, 10);
    const title = `**${LABELS[st]}** (${apps.length})`;
    const lines = apps.length ? apps.map(fmtItem).join('\n') : '_vazio_';
    parts.push(`${title}\n${lines}`);
  }
  return parts.join('\n\n');
}

export async function buildRecruitTabContent(opts: { guildId: string; filter: FilterKind }) {
  const body = await buildRecruitList(opts.guildId, opts.filter);

  const select = new StringSelectMenuBuilder()
    .setCustomId(ids.recruit.filter)
    .setPlaceholder('Filtrar por status')
    .addOptions(
      { label: 'Todas', value: 'all', default: opts.filter === 'all' },
      { label: 'Pendentes', value: 'pending', default: opts.filter === 'pending' },
      { label: 'Aprovadas', value: 'approved', default: opts.filter === 'approved' },
      { label: 'Recusadas', value: 'rejected', default: opts.filter === 'rejected' },
    );

  return buildScreen({
    title: 'Recrutamento',
    subtitle: 'Gerencie candidaturas e publique o painel público.',
    body,
    selects: [select],
    // 🔧 Aqui entram os 5 botões de Configurações + publicar + voltar
    buttons: [
      { id: ids.recruit.settingsForm, label: 'Editar formulário' },
      { id: ids.recruit.settingsPanelChannel, label: 'Canal de Recrutamento' },
      { id: ids.recruit.settingsFormsChannel, label: 'Canal de formulário' },
      { id: ids.recruit.settingsAppearance, label: 'Aparência' },
      { id: ids.recruit.settingsDM, label: 'DM Templates' },
      { id: ids.recruit.publish, label: 'Publicar Painel' },
    ],
    back: { id: 'dash:home', label: 'Voltar', emoji: '↩️' },
  });
}

/* ações simples usadas pelo router (staff) */
export async function approveApplication(_: unknown, id: string) {
  await recruitStore.updateStatus(id, 'approved');
}
export async function rejectApplication(_: unknown, id: string) {
  await recruitStore.updateStatus(id, 'rejected');
}
