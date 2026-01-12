import { Client, TextChannel } from 'discord.js';
import { eventsStore } from '../modules/events/store.js';
import { logger } from '../infra/logger.js';

/**
 * Scheduler robusto para lembretes de eventos.
 * - Verifica idempotência (não envia duplicado).
 * - Trata erros individualmente para não travar o loop.
 * - Usa intervalo de 1 minuto.
 */
export function startEventReminders(client: Client) {
  // Executa imediatamente e depois a cada 60s
  check(client);
  setInterval(() => check(client), 60_000);
}

async function check(client: Client) {
  try {
    // Busca eventos agendados para as próximas 25 horas (cobre 24h, 1h e 15m)
    const upcoming = await eventsStore.listScheduledInNext(25);

    for (const ev of upcoming) {
      const now = Date.now();
      const diff = ev.startsAt - now;

      // Definição das janelas de tempo (em ms)
      // Usamos uma margem de erro de ~2 minutos para garantir que o job pegue
      const MIN_15 = 15 * 60 * 1000;
      const HOUR_1 = 60 * 60 * 1000;
      const HOUR_24 = 24 * 60 * 60 * 1000;
      const MARGIN = 2 * 60 * 1000; // 2 minutos de tolerância

      // Lógica de decisão: qual lembrete enviar?
      let kind: '24h' | '1h' | '15m' | null = null;

      if (Math.abs(diff - HOUR_24) < MARGIN) kind = '24h';
      else if (Math.abs(diff - HOUR_1) < MARGIN) kind = '1h';
      else if (Math.abs(diff - MIN_15) < MARGIN) kind = '15m';

      if (!kind) continue;

      // 1. Verificação de Idempotência (Check DB)
      const alreadySent = await eventsStore.hasReminder(ev.id, kind);
      if (alreadySent) continue;

      // 2. Envio (com tratamento de erro isolado)
      try {
        await sendReminder(client, ev, kind);
        // 3. Marca como enviado APENAS se sucesso (ou falha controlada)
        await eventsStore.markReminder(ev.id, kind);
        logger.info({ eventId: ev.id, eventTitle: ev.title, reminderType: kind }, 'Event reminder sent');
      } catch (err) {
        logger.error({ error: err, eventId: ev.id, reminderType: kind }, 'Failed to send event reminder');
        // Não marcamos como feito para tentar novamente no próximo tick (se ainda estiver na margem)
        // Ou marcamos se for erro fatal (ex: canal deletado) para não spammar logs
      }
    }
  } catch (err) {
    logger.error({ error: err }, 'Fatal error in event reminders loop');
  }
}

async function sendReminder(client: Client, ev: any, kind: '24h' | '1h' | '15m') {
  // Busca lista de confirmados
  const rsvps = await eventsStore.listConfirmedUsers(ev.id);
  if (!rsvps.length) return;

  const timeStr = `<t:${Math.floor(ev.startsAt / 1000)}:R>`; // "em 15 minutos" dinâmico

  let successCount = 0;

  // Envia DM para cada confirmado
  for (const rsvp of rsvps) {
    try {
      const user = await client.users.fetch(rsvp.userId);
      await user.send(
        `🔔 **Lembrete de Evento:**\n\n` +
        `**${ev.title}**\n` +
        `Começa ${timeStr}!\n\n` +
        `Prepare-se! 🎮`,
      );
      successCount++;
    } catch {
      // DM fechada ou usuário saiu; ignoramos silenciosamente
    }
  }

  // Opcional: Avisar no canal do evento que os lembretes foram enviados
  if (successCount > 0 && kind !== '24h') {
    try {
      const channel = (await client.channels.fetch(ev.channelId)) as TextChannel;
      if (channel) {
        await channel.send({
          content: `🔔 **Lembrete:** O evento **${ev.title}** começa ${timeStr}. Notifiquei ${successCount} membros confirmados via DM.`,
        });
      }
    } catch {
      // Canal pode ter sido deletado
    }
  }
}
