import type { Client } from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { logger } from './logger.js';
import { Env, type EnvVars } from '../env.js';

export interface AppContext {
    client: Client;
    prisma: PrismaClient;
    logger: Logger;
    env: EnvVars;
}

// Singleton holder (inicializado no bootstrap)
let instance: AppContext | null = null;

export const Context = {
    init: (ctx: AppContext) => {
        instance = ctx;
    },
    get: (): AppContext => {
        if (!instance) {
            throw new Error('Context not initialized! Call Context.init() first.');
        }
        return instance;
    },
    /** Safe access helper (returns null if not ready) */
    tryGet: (): AppContext | null => instance,
};
