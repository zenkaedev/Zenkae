// src/config/constants.ts

/**
 * Timeouts usados em collectors, interactions, etc.
 */
export const TIMEOUTS = {
    /** Tempo padrão de collector (60 segundos) */
    COLLECTOR_DEFAULT: 60_000,

    /** Intervalo de fetch de membros (5 minutos) */
    MEMBER_FETCH_INTERVAL: 5 * 60 * 1000,

    /** Intervalo de limpeza de cooldowns (5 minutos) */
    COOLDOWN_CLEANUP: 10 * 60 * 1000,

    /** Cooldown de refresh do members panel (30 segundos) */
    MEMBER_REFRESH_COOLDOWN: 30 * 1000,
} as const;

/**
 * Limites de paginação e itens
 */
export const LIMITS = {
    /** Itens por página no rank */
    RANK_ITEMS_PER_PAGE: 7,

    /** Máximo de interações em collector antes de fechar */
    COLLECTOR_MAX_INTERACTIONS: 50,

    /** Máximo de membros a mostrar por classe no members panel */
    MEMBERS_PANEL_MAX_SHOW: 12,

    /** Máximo de perguntas no formulário de recrutamento */
    RECRUIT_MAX_QUESTIONS: 5,
} as const;

/**
 * Configurações do sistema de XP
 */
export const XP = {
    /** XP mínimo por mensagem */
    MESSAGE_MIN: 15,

    /** XP máximo por mensagem */
    MESSAGE_MAX: 25,

    /** XP por minuto em voz */
    VOICE_PER_MINUTE: 10,

    /** Cooldown de XP por mensagem (60 segundos) */
    MESSAGE_COOLDOWN: 60 * 1000,

    /** Expoente da curva de level (1.5) */
    LEVEL_EXPONENT: 1.5,

    /** Base de XP para level (100) */
    LEVEL_BASE_XP: 100,
} as const;

/**
 * Cores do tema
 */
export const COLORS = {
    /** Roxo principal (Zenkae brand) */
    PURPLE: 0x6d28d9,

    /** Laranja/Ouro (Members panel) */
    ORANGE: 0xFFA500,

    /** Vermelho (Erros) */
    RED: 0xff5555,

    /** Verde (Sucesso) */
    GREEN: 0x00ff00,
} as const;
