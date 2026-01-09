
/**
 * Helper para cálculo de períodos (Semanal / Mensal)
 * Fuso horário: America/Sao_Paulo (UTC-3)
 * Semana começa: Segunda-feira
 */
export const periodUtils = {
    /**
     * Retorna o Date correspondente ao início da semana atual (Segunda 00:00 BRT)
     */
    getCurrentWeekStart(): Date {
        // Usamos Intl para garantir timezone correto independente do servidor
        // O "truque" é pegar a data string no time zone e parsear de volta
        const now = new Date();
        const brtDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

        // Ajustar para 00:00:00
        brtDate.setHours(0, 0, 0, 0);

        // Ajustar para Segunda-feira (1)
        // getDay(): 0 = Domingo, 1 = Segunda, ...
        const day = brtDate.getDay();
        const diff = brtDate.getDate() - day + (day === 0 ? -6 : 1);
        // Se Domingo (0) -> -6 (volta pra segunda anterior)
        // Se Segunda (1) -> 1 (mantém) -> wait:
        // Ex: Segunda (1): dif = 1 - 1 + 1 = 1. Mantém? Não.
        // Se Segunda (1): Segunda 00:00 já é o start.
        // Vamos usar matemática de diferença simples:
        // day 1 (seg) -> sub 0
        // day 2 (ter) -> sub 1
        // ...
        // day 0 (dom) -> sub 6

        const daysToSubtract = day === 0 ? 6 : day - 1;
        brtDate.setDate(brtDate.getDate() - daysToSubtract);

        // Converter de volta para UTC timestamp real do momento 00:00 BRT
        // A data 'brtDate' agora tem os componentes certos (ex: 2023-01-09 00:00) mas está no timezone local do servidor se usarmos getTime direto?
        // Não, o objeto Date em JS é sempre timestamp.
        // Precisamos criar um Date que REPRESENTE aquele instante.
        // A forma mais segura é construir a string ISO e forçar o offset.

        const year = brtDate.getFullYear();
        const month = String(brtDate.getMonth() + 1).padStart(2, '0');
        const d = String(brtDate.getDate()).padStart(2, '0');

        // Horário de Brasília é -03:00 (ou -02:00 verão)
        // Para simplificar, vamos salvar apenas a DATA (YYYY-MM-DD) convertida para UTC-0
        // "O inicio da semana de referência" será representado por um Date UTC.
        // Assim, weekStart = 2026-01-05T00:00:00.000Z (que seria Segunda)

        return new Date(Date.UTC(year, brtDate.getMonth(), brtDate.getDate()));
    },

    getCurrentMonthStart(): Date {
        const now = new Date();
        const brtDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

        const year = brtDate.getFullYear();
        const month = brtDate.getMonth(); // 0-based

        return new Date(Date.UTC(year, month, 1));
    }
};
