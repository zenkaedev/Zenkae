import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from 'discord.js';
import { activityStore } from './store.js';
import { buildScreen, replyV2Notice } from '../../ui/v2.js';

function weekStart(d = new Date()) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day + 6) % 7;
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - diff);
  return dt;
}

function panel(count: number, week: Date) {
  return buildScreen({
    title: '✅ Check-in semanal',
    subtitle: `Semana iniciada em **${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(week)}**`,
    body: `**Ativos nesta semana:** ${count}\n\nClique em **Estou ativo** para marcar sua presença.`,
    buttons: [{ id: 'activity:check', label: 'Estou ativo' }],
  });
}

export async function publishActivityPanel(inter: ButtonInteraction | ChatInputCommandInteraction) {
  if (!inter.inCachedGuild()) return;

  const ch = inter.channel;
  if (!ch?.isTextBased()) {
    await replyV2Notice(inter, '❌ Use em um canal de texto.', true);
    return;
  }

  const week = weekStart();
  const count = await activityStore.countSince(inter.guildId!, week);
  const payload = panel(count, week);

  const sent = await (ch as GuildTextBasedChannel).send(payload);
  await activityStore.setPanel(inter.guildId!, {
    channelId: ch.id,
    messageId: sent.id,
    weekStart: week,
  });

  await replyV2Notice(inter, 'Painel de check-in publicado.', true);
}

export async function handleActivityCheck(inter: ButtonInteraction) {
  if (!inter.inCachedGuild()) return;
  const guildId = inter.guildId!;
  const week = weekStart();
  await activityStore.upsertCheck(guildId, inter.user.id);

  const panelRef = await activityStore.getPanel(guildId);
  if (panelRef) {
    try {
      const ch = inter.channel!;
      const msg = await (ch as GuildTextBasedChannel).messages.fetch(panelRef.messageId);
      const count = await activityStore.countSince(guildId, week);
      await msg.edit(panel(count, week));
    } catch {
      // ignore
    }
  }

  await replyV2Notice(inter, '✅ Check-in registrado para esta semana!', true);
}
