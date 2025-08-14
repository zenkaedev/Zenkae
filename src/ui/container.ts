import {
  AttachmentBuilder,
  StringSelectMenuBuilder,
  type JSONEncodable,
  type APIMessageTopLevelComponent,
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

import type { FilterKind } from '../modules/recruit/types';
import { buildRecruitList } from '../modules/recruit/staff';
import { buildEventsList } from '../modules/events/staff';
import { buildScreen, loadBannerFrom, loadDefaultBanner } from './v2';

export type DashTab = 'home' | 'recruit' | 'events' | 'admin';
export type DashState = { tab: DashTab; guildId?: string; filter?: FilterKind };

/** Payload V2 devolvido para reply/update */
export type DashboardView = {
  components: (JSONEncodable<APIMessageTopLevelComponent> | APIMessageTopLevelComponent)[];
  files?: AttachmentBuilder[];
  flags?: number;
};

// tenta achar banner por aba; se não achar, usa o de dashboard
function bannerFor(tab: DashTab) {
  const dir =
    tab === 'home'   ? 'dashboard' :
    tab === 'recruit'? 'recruit'   :
    tab === 'events' ? 'events'    :
                       'admin';

  return loadBannerFrom(dir) ?? loadDefaultBanner();
}

export async function renderDashboard(state: DashState): Promise<DashboardView> {
  const banner = bannerFor(state.tab);

  if (state.tab === 'recruit') {
    const filter: FilterKind = state.filter ?? 'all';
    const { text } = await buildRecruitList(state.guildId ?? '', filter);

    const select = new StringSelectMenuBuilder()
      .setCustomId('recruit:filter')
      .setPlaceholder('Filtrar candidaturas')
      .addOptions(
        { label: 'Todas',     value: 'all',      default: filter === 'all' },
        { label: 'Pendentes', value: 'pending',  default: filter === 'pending' },
        { label: 'Aprovadas', value: 'approved', default: filter === 'approved' },
        { label: 'Recusadas', value: 'rejected', default: filter === 'rejected' },
      );

    return buildScreen({
      banner,
      title: 'Recrutamento',
      subtitle: 'Gerencie aplicações e publique o painel público.',
      body: text,
      selects: [select],
      buttons: [{ id: 'recruit:publish', label: 'Publicar Painel' }],
      back: { id: 'dash:home', label: 'Voltar' },
    }) as DashboardView;
  }

  if (state.tab === 'events') {
    const list = await buildEventsList(state.guildId ?? '');
    const lines: string[] = [];
    for (const e of list) {
      const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(e.startsAt));
      lines.push(`- **${e.title}** — ${when} · ✅ ${e.yes} · ❔ ${e.maybe} · ❌ ${e.no}`);
    }
    const body = lines.length ? lines.join('\n') : '_Nenhum evento agendado._';

    return buildScreen({
      banner,
      title: 'Eventos',
      subtitle: 'Prévia e gerenciamento dos próximos eventos.',
      body,
      buttons: [{ id: 'events:new', label: 'Novo Evento' }],
      back: { id: 'dash:home', label: 'Voltar' },
    }) as DashboardView;
  }

  if (state.tab === 'admin') {
    return buildScreen({
      banner,
      title: 'Admin',
      subtitle: 'Utilidades e manutenção do servidor.',
      body:
        `- **Check-in semanal**: publica o painel público.\n` +
        `- **Limpar**: remove componentes desta mensagem.\n`,
      buttons: [
        { id: 'activity:publish', label: 'Ativar Check-in Semanal' },
        { id: 'admin:clean',      label: 'Limpar esta mensagem'   },
      ],
      back: { id: 'dash:home', label: 'Voltar' },
    }) as DashboardView;
  }

  // Home
  return buildScreen({
    banner,
    title: 'Dashboard',
    subtitle: 'Instruções rápidas:',
    body:
      `**Recruit** → fluxo público + fila\n` +
      `**Eventos** → criação, RSVP e lembretes\n` +
      `**Admin** → check-in e utilidades`,
    buttons: [
      { id: 'dash:recruit', label: 'Recruit' },
      { id: 'dash:events',  label: 'Eventos' },
      { id: 'dash:admin',   label: 'Admin'   },
    ],
  }) as DashboardView;
}
