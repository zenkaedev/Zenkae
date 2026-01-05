import pino from 'pino';
import { Env } from '../env.js';

const targets: pino.TransportTargetOptions[] = [
    {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    },
];

export const logger = pino({
    level: Env.LOG_LEVEL || 'info',
    transport: {
        targets,
    },
    base: undefined, // remove pid/hostname
});
