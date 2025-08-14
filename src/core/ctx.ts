// src/core/ctx.ts
import type { Logger as PinoLogger } from 'pino';
import prisma from '../db/prisma';
import { GuildConfigRepo } from '../db/repos/guildConfig.repo';
import { createApplicationRepo } from '../db/repos/application.repo';

export interface AppCtx {
  logger: PinoLogger;
  repos: {
    guildConfig: GuildConfigRepo; // agora o tipo é a classe
    application: ReturnType<typeof createApplicationRepo>;
  };
}

export function makeCtx(logger: PinoLogger): AppCtx {
  return {
    logger,
    repos: {
      guildConfig: new GuildConfigRepo(prisma),
      application: createApplicationRepo(prisma),
    },
  };
}

export const createBaseCtx = makeCtx;
