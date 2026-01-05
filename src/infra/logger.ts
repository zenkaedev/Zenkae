import pino from 'pino';
import { Env } from '../env.js';

const isDev = process.env.NODE_ENV !== 'production';

const targets: pino.TransportTargetOptions[] = isDev ? [
    {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    },
] : [];

export const logger = pino({
    level: Env.LOG_LEVEL || 'info',
    transport: targets.length > 0 ? {
        targets,
    } : undefined,
    base: undefined, // remove pid/hostname
});
