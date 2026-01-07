// src/services/renderer/templates/RankList.tsx
import React from 'react';

interface RankUser {
    userId: string;
    username: string;
    avatarUrl: string;
    level: number;
    xpTotal: number;
    rank: number;
}

interface RankListProps {
    topUsers: RankUser[];
    requestingUser?: RankUser; // Se não estiver no top 10
    guildName: string;
    guildColor?: string;
}

export function RankList(props: RankListProps) {
    const { topUsers, requestingUser, guildName } = props;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '900px',
                height: '1200px',
                background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
                padding: '48px',
                position: 'relative',
            }}
        >
            {/* Header - Nome do Servidor em Destaque */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '36px',
                    paddingBottom: '24px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <span
                    style={{
                        fontSize: '48px',
                        fontWeight: '700',
                        color: '#fff',
                        marginBottom: '8px',
                        letterSpacing: '-0.5px',
                    }}
                >
                    {guildName}
                </span>
                <span
                    style={{
                        fontSize: '18px',
                        fontWeight: '500',
                        color: 'rgba(255,255,255,0.5)',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                    }}
                >
                    🏆 Ranking
                </span>
            </div>

            {/* Lista de Usuários - Clean Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {topUsers.map((user) => {
                    const isTop3 = user.rank <= 3;
                    const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '';

                    return (
                        <div
                            key={user.userId}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: isTop3 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                                padding: isTop3 ? '20px 24px' : '16px 24px',
                                borderRadius: '16px',
                                border: isTop3
                                    ? '1px solid rgba(255,255,255,0.2)'
                                    : '1px solid rgba(255,255,255,0.08)',
                                gap: '20px',
                            }}
                        >
                            {/* Rank Number ou Medal */}
                            <div
                                style={{
                                    minWidth: '50px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {medal ? (
                                    <span style={{ fontSize: '32px' }}>{medal}</span>
                                ) : (
                                    <span
                                        style={{
                                            fontSize: '24px',
                                            fontWeight: '700',
                                            color: 'rgba(255,255,255,0.4)',
                                        }}
                                    >
                                        #{user.rank}
                                    </span>
                                )}
                            </div>

                            {/* Avatar */}
                            <img
                                src={user.avatarUrl}
                                style={{
                                    width: isTop3 ? '60px' : '48px',
                                    height: isTop3 ? '60px' : '48px',
                                    borderRadius: '50%',
                                    border: isTop3
                                        ? '3px solid rgba(255,255,255,0.3)'
                                        : '2px solid rgba(255,255,255,0.15)',
                                }}
                            />

                            {/* Username */}
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: isTop3 ? '22px' : '18px',
                                        fontWeight: isTop3 ? '700' : '600',
                                        color: '#fff',
                                        marginBottom: '4px',
                                    }}
                                >
                                    {user.username}
                                </span>
                                <span
                                    style={{
                                        fontSize: '13px',
                                        color: 'rgba(255,255,255,0.5)',
                                        fontWeight: '500',
                                    }}
                                >
                                    {user.xpTotal.toLocaleString()} XP
                                </span>
                            </div>

                            {/* Level Badge */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: isTop3 ? '18px' : '16px',
                                        fontWeight: '700',
                                        color: '#fff',
                                    }}
                                >
                                    Nv. {user.level}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer - Posição do Usuário Solicitante (se não está no top 10) */}
            {requestingUser && requestingUser.rank > 10 && (
                <div
                    style={{
                        marginTop: '24px',
                        paddingTop: '24px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            padding: '16px 24px',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            gap: '20px',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: 'rgba(255,255,255,0.6)',
                                minWidth: '100px',
                            }}
                        >
                            Sua posição:
                        </span>
                        <span
                            style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                color: '#fff',
                            }}
                        >
                            #{requestingUser.rank}
                        </span>
                        <span
                            style={{
                                fontSize: '14px',
                                color: 'rgba(255,255,255,0.5)',
                            }}
                        >
                            Nível {requestingUser.level} • {requestingUser.xpTotal.toLocaleString()} XP
                        </span>
                    </div>
                </div>
            )}

            {/* Footer minimalista */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '24px',
                    right: '48px',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.25)',
                    fontWeight: '500',
                    letterSpacing: '0.5px',
                }}
            >
                ZENKAE
            </div>
        </div>
    );
}
