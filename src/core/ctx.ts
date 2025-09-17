// src/core/ctx.ts
import type { Logger as PinoLogger } from 'pino';
import prisma from '../db/prisma.js';
import { GuildConfigRepo } from '../db/repos/guildConfig.repo.js';
// CORREÇÃO 1: Importamos a classe, e para clareza, vamos chamá-la pelo seu nome real.
import ApplicationRepo from '../db/repos/application.repo.js';

export interface AppCtx {
  logger: PinoLogger;
  repos: {
    guildConfig: GuildConfigRepo;
    // CORREÇÃO 2: O tipo da instância é a própria classe.
    application: ApplicationRepo;
  };
}

export function makeCtx(logger: PinoLogger): AppCtx {
  return {
    logger,
    repos: {
      guildConfig: new GuildConfigRepo(),
      // CORREÇÃO 3: Instanciamos a classe usando 'new' sem argumentos, pois o construtor não espera nenhum.
      application: new ApplicationRepo(),
    },
  };
}

export const createBaseCtx = makeCtx;
