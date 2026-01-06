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
    const { topUsers, requestingUser, guildName, guildColor = '#FFD700' } = props;

    // Renderiza uma linha do ranking
    const renderRankLine = (user: RankUser, isHighlight = false) => {
        const medalEmoji = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '';
        const isTop3 = user.rank <= 3;

        return (
            <div
                key={user.userId}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: isTop3 ? '16px' : '12px',
                    backgroundColor: isHighlight
                        ? 'rgba(255, 215, 0, 0.15)'
                        : user.rank % 2 === 0
                            ? 'rgba(0,0,0,0.4)'
                            : 'rgba(0,0,0,0.6)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    border: isHighlight ? `2px solid ${guildColor}` : isTop3 ? '2px solid rgba(255,255,255,0.2)' : 'none',
                }}
            >
                {/* Rank e Medal */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isTop3 ? '80px' : '60px',
                        marginRight: '16px',
                    }}
                >
                    {medalEmoji && (
                        <span style={{ fontSize: isTop3 ? '40px' : '24px', marginRight: '8px' }}>
                            {medalEmoji}
                        </span>
                    )}
                    <span
                        style={{
                            fontSize: isTop3 ? '32px' : '20px',
                            fontWeight: 'bold',
                            color: isTop3 ? guildColor : '#aaa',
                        }}
                    >
                        #{user.rank}
                    </span>
                </div>

                {/* Avatar */}
                <img
                    src={user.avatarUrl}
                    style={{
                        width: isTop3 ? '64px' : '48px',
                        height: isTop3 ? '64px' : '48px',
                        borderRadius: isTop3 ? '32px' : '24px',
                        marginRight: '16px',
                        border: isTop3 ? `3px solid ${guildColor}` : '2px solid rgba(255,255,255,0.2)',
                    }}
                />

                {/* Username */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span
                        style={{
                            fontSize: isTop3 ? '28px' : '20px',
                            fontWeight: isTop3 ? 'bold' : 'normal',
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '300px',
                        }}
                    >
                        {user.username}
                    </span>
                    <span style={{ fontSize: '14px', color: '#888' }}>
                        {user.xpTotal.toLocaleString()} XP
                    </span>
                </div>

                {/* Level */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isTop3 ? guildColor : 'rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                    }}
                >
                    <span
                        style={{
                            fontSize: isTop3 ? '24px' : '18px',
                            fontWeight: 'bold',
                            color: isTop3 ? '#000' : '#fff',
                        }}
                    >
                        Nível {user.level}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '900px',
                height: '1200px',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                padding: '40px',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '32px',
                    paddingBottom: '24px',
                    borderBottom: `3px solid ${guildColor}`,
                }}
            >
                <span style={{ fontSize: '48px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                    🏆 RANKING
                </span>
                <span style={{ fontSize: '24px', color: guildColor }}>
                    {guildName}
                </span>
            </div>

            {/* Top Users */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {topUsers.map((user) => renderRankLine(user))}
            </div>

            {/* Requesting User (se não estiver no top 10) */}
            {requestingUser && requestingUser.rank > 10 && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px solid rgba(255,255,255,0.2)' }}>
                    <span style={{ fontSize: '16px', color: '#888', marginBottom: '12px', display: 'block' }}>
                        Sua posição:
                    </span>
                    {renderRankLine(requestingUser, true)}
                </div>
            )}

            {/* Footer */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '24px',
                    fontSize: '14px',
                    color: '#666',
                }}
            >
                ZenKae Bot • Ranking atualizado em tempo real
            </div>
        </div>
    );
}
