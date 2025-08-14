// Logger central (pino) com campos padrão comuns
import pino from 'pino';

const base = {
  service: 'zenkae',
};

export function createLogger(scope?: string) {
  const level = process.env.LOG_LEVEL || 'info';
  const logger = pino({ level }).child(scope ? { ...base, scope } : base);
  return logger;
}

export type Logger = ReturnType<typeof createLogger>;
