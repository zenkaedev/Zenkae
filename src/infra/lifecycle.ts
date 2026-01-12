// src/infra/lifecycle.ts
import { logger } from './logger.js';

/**
 * Lifecycle Manager - Gerencia recursos que precisam ser limpos ao desligar o bot
 * Previne memory leaks de intervals/timers/listeners duplicados
 */
class LifecycleManager {
    private intervals: NodeJS.Timeout[] = [];
    private cleanupCallbacks: (() => void | Promise<void>)[] = [];

    /**
     * Registra um interval que será limpo automaticamente no shutdown
     */
    registerInterval(fn: () => void, ms: number, name?: string): NodeJS.Timeout {
        const interval = setInterval(fn, ms);
        this.intervals.push(interval);

        if (name) {
            logger.debug({ intervalName: name, intervalMs: ms }, 'Interval registered');
        }

        return interval;
    }

    /**
     * Registra uma callback de cleanup customizada
     */
    registerCleanup(fn: () => void | Promise<void>, name?: string) {
        this.cleanupCallbacks.push(fn);

        if (name) {
            logger.debug({ cleanupName: name }, 'Cleanup callback registered');
        }
    }

    /**
     * Limpa todos os recursos registrados
     */
    async cleanup() {
        logger.info('Starting lifecycle cleanup...');

        // Clear all intervals
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        logger.info({ count: this.intervals.length }, 'Intervals cleared');
        this.intervals = [];

        // Run cleanup callbacks
        for (const callback of this.cleanupCallbacks) {
            try {
                await callback();
            } catch (err) {
                logger.error({ error: err }, 'Error in cleanup callback');
            }
        }
        logger.info({ count: this.cleanupCallbacks.length }, 'Cleanup callbacks executed');
        this.cleanupCallbacks = [];

        logger.info('Lifecycle cleanup complete');
    }
}

export const lifecycle = new LifecycleManager();

// Register cleanup on process signals
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received');
    await lifecycle.cleanup();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received');
    await lifecycle.cleanup();
    process.exit(0);
});
