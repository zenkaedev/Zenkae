// src/services/xp/types.ts

/**
 * Resultado de adicionar XP por mensagem
 */
export interface XPResult {
    levelUp: boolean;
    newLevel: number;
    xpGained: number;
}

/**
 * Dados de nível do usuário
 */
export interface UserLevel {
    level: number;
    xpTotal: number;
    xpInCurrentLevel: number;
    xpForNextLevel: number;
    xpProgress: number; // 0-100
}

/**
 * Usuário no ranking
 */
export interface UserXP {
    userId: string;
    xpTotal: number;
    level: number;
}

/**
 * Usuário no ranking de período
 */
export interface PeriodUserXP {
    userId: string;
    xp: number;
    rank?: number;
}

/**
 * Interface do XP Store
 * Define contract para todas as operações de XP
 * (Fix #11: Permite mockar para testes e dependency injection)
 */
export interface IXPStore {
    /**
     * Calcula XP necessário para o próximo nível
     */
    getXPForLevel(level: number): number;

    /**
     * Calcula nível baseado no XP total
     */
    getLevelFromXP(xpTotal: number): number;

    /**
     * Adiciona XP ao usuário por mensagem (com cooldown de 60s)
     */
    addMessageXP(guildId: string, userId: string): Promise<XPResult>;

    /**
     * Adiciona XP por tempo em voz
     */
    addVoiceXP(guildId: string, userId: string, seconds: number): Promise<void>;

    /**
   * Busca dados de XP do usuário
   */
    getUserLevel(guildId: string, userId: string): Promise<UserLevel>;

    /**
     * Busca dados de XP de múltiplos usuários (batch query - Fix #4)
     * Otimização para evitar N+1 queries
     */
    getBatchUserLevels(guildId: string, userIds: string[]): Promise<Map<string, UserLevel>>;

    /**
     * Total de XP necessário para chegar em um nível
     */
    getTotalXPForLevel(level: number): number;

    /**
     * Busca top usuários por XP
     */
    getTopUsers(guildId: string, limit?: number): Promise<UserXP[]>;

    /**
     * Busca posição do usuário no ranking
     */
    getUserRank(guildId: string, userId: string): Promise<number>;

    /**
     * Gera XP aleatório entre min e max
     */
    randomXP(min: number, max: number): number;

    /**
     * Adiciona XP nos contadores de período
     */
    addPeriodXP(guildId: string, userId: string, xp: number): Promise<void>;

    /**
     * Busca top usuários de um período (semanal/mensal)
     */
    getPeriodTopUsers(guildId: string, type: 'WEEKLY' | 'MONTHLY', limit?: number): Promise<PeriodUserXP[]>;
}
