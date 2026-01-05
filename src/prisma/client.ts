import { Context } from '../infra/context.js';
// Getter preguiçoso para compatibilidade e Singleton
export const prisma = new Proxy({} as any, {
    get(target, prop) {
        return (Context.get().prisma as any)[prop];
    }
});
