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
    requestingUser?: RankUser;
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
                background: '#1b2838', // Steam dark blue-gray
                padding: '40px',
                borderRadius: '12px',
            }}
        >
            {/* Header - Steam Style */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: '32px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid #2a475e',
                }}
            >
                <span
                    style={{
                        fontSize: '14px',
                        color: '#66c0f4', // Steam blue
                        textTransform: 'uppercase',
                        fontWeight: '600',
                        marginBottom: '8px',
                        letterSpacing: '1.5px',
                    }}
                >
                    Leaderboard
                </span>
                <span
                    style={{
                        fontSize: '42px',
                        fontWeight: '700',
                        color: '#c7d5e0',
                    }}
                >
                    {guildName}
                </span>
            </div>

            {/* User List - Clean Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {topUsers.map((user) => {
                    const isTop3 = user.rank <= 3;
                    const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '';

                    return (
                        <div
                            key={user.userId}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: isTop3 ? '#2a475e' : '#16202d',
                                padding: isTop3 ? '18px 20px' : '14px 20px',
                                borderRadius: '6px',
                                gap: '16px',
                                border: isTop3 ? '1px solid #66c0f4' : 'none',
                            }}
                        >
                            {/* Rank */}
                            <div
                                style={{
                                    display: 'flex',
                                    minWidth: '60px',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {medal ? (
                                    <span style={{ fontSize: '28px' }}>{medal}</span>
                                ) : (
                                    <span
                                        style={{
                                            fontSize: isTop3 ? '24px' : '20px',
                                            fontWeight: '700',
                                            color: isTop3 ? '#66c0f4' : '#8f98a0',
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
                                    width: isTop3 ? '56px' : '48px',
                                    height: isTop3 ? '56px' : '48px',
                                    borderRadius: '6px',
                                    border: isTop3 ? '2px solid #66c0f4' : '2px solid #2a475e',
                                }}
                            />

                            {/* User Info */}
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
                                        color: '#c7d5e0',
                                        marginBottom: '2px',
                                    }}
                                >
                                    {user.username}
                                </span>
                                <span
                                    style={{
                                        fontSize: '13px',
                                        color: '#8f98a0',
                                        fontWeight: '600',
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
                                    backgroundColor: isTop3 ? '#66c0f4' : '#2a475e',
                                    padding: '8px 18px',
                                    borderRadius: '4px',
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: isTop3 ? '18px' : '16px',
                                        fontWeight: '700',
                                        color: isTop3 ? '#1b2838' : '#c7d5e0',
                                    }}
                                >
                                    Nv. {user.level}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer - User Position (if >10) */}
            {requestingUser && requestingUser.rank > 10 && (
                <div
                    style={{
                        display: 'flex',
                        marginTop: '24px',
                        paddingTop: '20px',
                        borderTop: '1px solid #2a475e',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#16202d',
                            padding: '14px 20px',
                            borderRadius: '6px',
                            gap: '16px',
                            flex: 1,
                            border: '1px solid #66c0f4',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#8f98a0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}
                        >
                            Sua posição:
                        </span>
                        <span
                            style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                color: '#66c0f4',
                            }}
                        >
                            #{requestingUser.rank}
                        </span>
                        <span
                            style={{
                                fontSize: '14px',
                                color: '#c7d5e0',
                                fontWeight: '600',
                            }}
                        >
                            Nível {requestingUser.level} • {requestingUser.xpTotal.toLocaleString()} XP
                        </span>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '16px',
                }}
            >
                <span
                    style={{
                        fontSize: '10px',
                        color: '#495967',
                        fontWeight: '600',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                    }}
                >
                    Zenkae
                </span>
            </div>
        </div>
    );
}
