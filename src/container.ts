import {
  StringSelectMenuBuilder,
  type JSONEncodable,
  type APIMessageTopLevelComponent,
  type AttachmentBuilder,
} from 'discord.js';

import type { FilterKind } from './modules/recruit/types.js';
import { buildRecruitList } from './modules/recruit/staff.js';
import { buildEventsList } from './modules/events/staff.js';
import { buildScreen, loadBannerFrom, loadDefaultBanner } from './ui/v2.js';
import { ids } from './ui/ids.js';
import { suggestionStore } from './modules/suggestions/store.js';

export type DashTab = 'home' | 'recruit' | 'events' | 'admin' | 'suggestions' | 'matchmaking';
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
    tab === 'home'
      ? 'dashboard'
      : tab === 'recruit'
        ? 'recruit'
        : tab === 'events'
          ? 'events'
          : tab === 'matchmaking'
            ? 'matchmaking'
            : 'admin';

  return loadBannerFrom(dir) ?? loadDefaultBanner();
}

export async function renderDashboard(state: DashState): Promise<DashboardView> {
  const banner = bannerFor(state.tab);

  /* -------------------- RECRUIT -------------------- */
  if (state.tab === 'recruit') {
    const filter: FilterKind = state.filter ?? 'all';
    const text = await buildRecruitList(state.guildId ?? '', filter);

    const select = new StringSelectMenuBuilder()
      .setCustomId(ids.recruit.filter)
      .setPlaceholder('Filtrar candidaturas')
      .addOptions(
        { label: 'Todas', value: 'all', default: filter === 'all' },
        { label: 'Pendentes', value: 'pending', default: filter === 'pending' },
        { label: 'Aprovadas', value: 'approved', default: filter === 'approved' },
        { label: 'Recusadas', value: 'rejected', default: filter === 'rejected' },
      );

    return buildScreen({
      banner,
      title: 'Recrutamento',
      subtitle: 'Gerencie aplicações e publique o painel público.',
      body: text,
      selects: [select],
      buttons: [
        { id: ids.recruit.publish, label: 'Publicar Painel' },
        { id: 'recruit:settings', label: '⚙️ Configurar' },
        { id: 'recruit:clear-completed', label: '🗑️ Limpar Finalizados' },
      ],
      back: { id: 'dash:home', label: 'Voltar' },
    }) as DashboardView;
  }

  /* -------------------- EVENTS -------------------- */
  if (state.tab === 'events') {
    const list = await buildEventsList(state.guildId ?? '');
    const lines: string[] = [];
    for (const e of list) {
      const when = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(e.startsAt));
      lines.push(`- **${e.title}** — ${when} · ✅ ${e.yes} · ❔ ${e.maybe} · ❌ ${e.no}`);
    }
    const body = lines.length ? lines.join('\n') : '_Nenhum evento agendado._';

    return buildScreen({
      banner,
      title: 'Eventos',
      subtitle: 'Prévia e gerenciamento dos próximos eventos.',
      body,
      buttons: [
        { id: ids.events.new, label: 'Novo Evento' },
        { id: 'events:manager:open', label: '⚙️ Gerenciar' }
      ],
      back: { id: 'dash:home', label: 'Voltar' },
    }) as DashboardView;
  }

  /* -------------------- MATCHMAKING -------------------- */
  if (state.tab === 'matchmaking') {
    return buildScreen({
      banner,
      title: 'Matchmaking 🎮',
      subtitle: 'Sistema de formação de grupos',
      body: `**Sistema de LFG (Looking for Group)**\n\nPublique o totem em um canal para permitir que membros criem parties para dungeons, raids e atividades.`,
      buttons: [
        { id: 'matchmaking:publishTotem', label: '📍 Publicar Totem' },
      ],
      back: { id: ids.dash.tab('home'), label: 'Voltar' },
    });
  }

  /* -------------------- ADMIN -------------------- */
  if (state.tab === 'admin') {
    return buildScreen({
      banner,
      title: 'Admin',
      subtitle: 'Ferramentas administrativas',
      body: '_Em breve: ferramentas de moderação e gestão._',
      buttons: [{ id: ids.admin.clean, label: '🧹 Limpar Banco de Dados' }],
      back: { id: ids.dash.tab('home'), label: 'Voltar' },
    });
  }

  /* -------------------- SUGGESTIONS -------------------- */
  if (state.tab === 'suggestions') {
    const settings = await suggestionStore.getSettings(state.guildId ?? '');

    const channelMention = settings.suggestionsChannelId
      ? `<#${settings.suggestionsChannelId}>`
      : '_Não configurado_';

    const panelStatus = settings.panelMessageId
      ? '✅ Painel publicado'
      : '⚠️ Painel não publicado';

    return buildScreen({
      banner,
      title: 'Sugestões 📢',
      subtitle: 'Sistema de sugestões da comunidade',
      body: `**Canal de sugestões:** ${channelMention}\n**Status:** ${panelStatus}`,
      buttons: [
        { id: 'suggestions:publish', label: '📢 Publicar Painel' },
        { id: 'suggestions:setChannel', label: '⚙️ Configurar Canal' }
      ],
      back: { id: ids.dash.tab('home'), label: 'Voltar' },
    });
  }

  /* -------------------- HOME -------------------- */
  return buildScreen({
    banner,
    title: 'Dashboard',
    subtitle: 'Gerencie seu servidor',
    body: '_Escolha uma categoria abaixo para gerenciar._',
    buttons: [
      { id: ids.dash.tab('recruit'), label: '📋 Recrutamento' },
      { id: ids.dash.tab('events'), label: '📅 Eventos' },
      { id: ids.dash.tab('matchmaking'), label: '🎮 Matchmaking' },
      { id: ids.dash.tab('suggestions'), label: '📢 Sugestões' },
      { id: ids.dash.tab('admin'), label: '⚙️ Admin' },
    ],
  }) as DashboardView;
}
