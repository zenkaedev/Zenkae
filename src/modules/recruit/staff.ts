import type { ButtonInteraction } from 'discord.js';
import { recruitStore, type ApplicationStatus } from './store';
import { buildScreen } from '../../ui/v2';
import { ids } from '../../ui/ids';

export type FilterKind = 'all' | 'pending' | 'approved' | 'rejected';

export async function buildRecruitList(guildId: string, filter: FilterKind) {
  const status: ApplicationStatus[] =
    filter === 'all' ? ['pending', 'approved', 'rejected'] : [filter];

  const rows = await Promise.all(
    status.map(async (st) => {
      const apps = await recruitStore.listByStatus(guildId, st, 10);
      const lines =
        apps.length === 0
          ? '_vazio_'
          : apps.map((a) => `• \`${a.username}\` — **${a.nick}** (${a.className})`).join('\n');
      return `**${st.toUpperCase()}**\n${lines}`;
    }),
  );

  return { text: rows.join('\n\n') };
}

export async function approveApplication(_i: ButtonInteraction, id: string) {
  await recruitStore.updateStatus(id, 'approved');
}

export async function rejectApplication(_i: ButtonInteraction, id: string) {
  await recruitStore.updateStatus(id, 'rejected');
}

export async function buildRecruitTabContent(params: { guildId: string; filter: FilterKind }) {
  const { text } = await buildRecruitList(params.guildId, params.filter);
  return buildScreen({
    title: 'Recrutamento',
    subtitle: 'Fila de candidaturas',
    body: text,
    buttons: [{ id: ids.recruit.publish, label: 'Publicar Painel' }],
    back: { id: 'dash:home', label: 'Voltar' },
  });
}
