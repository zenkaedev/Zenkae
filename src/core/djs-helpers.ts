// src/core/djs-helpers.ts
import {
  MessageFlags,
  type InteractionReplyOptions,
  type InteractionDeferReplyOptions,
  type MessageMentionTypes,
  type MessageMentionOptions,
} from 'discord.js';

/** Nenhuma menção (tipado certinho pro TS não reclamar). */
export const NO_MENTIONS: MessageMentionOptions = { parse: [], repliedUser: false };

/** Empacota um reply/followUp com flag efêmero (API nova do Discord). */
export function eph(opts: InteractionReplyOptions): any {
  // `flags` ainda não aparece no tipo do discord.js, então retornamos `any` mesmo.
  return { ...opts, flags: MessageFlags.Ephemeral };
}

/** Opções pra deferReply efêmero (sem warnings). */
export function ephDefer(opts: InteractionDeferReplyOptions = {}): any {
  return { ...opts, flags: MessageFlags.Ephemeral };
}
