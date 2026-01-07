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
                background: '#1b2838',
                padding: '40px',
                borderRadius: '12px',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: '28px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid #2a475e',
                }}
            >
                <span
                    style={{
                        fontSize: '13px',
                        color: '#66c0f4',
                        textTransform: 'uppercase',
                        fontWeight: '600',
                        marginBottom: '6px',
                        letterSpacing: '1.5px',
                    }}
                >
                    Leaderboard
                </span>
                <span style={{ fontSize: '40px', fontWeight: '700', color: '#c7d5e0' }}>
                    {guildName}
                </span>
            </div>

            {/* User List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {topUsers.map((user) => {
                    const isTop3 = user.rank <= 3;

                    return (
                        <div
                            key={user.userId}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: isTop3 ? '#2a475e' : '#16202d',
                                padding: isTop3 ? '16px 18px' : '12px 18px',
                                borderRadius: '6px',
                                gap: '14px',
                                border: isTop3 ? '1px solid #66c0f4' : 'none',
                            }}
                        >
                            {/* Rank */}
                            <div style={{ display: 'flex', minWidth: '50px', alignItems: 'center', justifyContent: 'center' }}>
                                <span
                                    style={{
                                        fontSize: isTop3 ? '22px' : '18px',
                                        fontWeight: '700',
                                        color: isTop3 ? '#66c0f4' : '#8f98a0',
                                    }}
                                >
                                    #{user.rank}
                                </span>
                            </div>

                            {/* Avatar */}
                            <img
                                src={user.avatarUrl}
                                style={{
                                    width: isTop3 ? '52px' : '44px',
                                    height: isTop3 ? '52px' : '44px',
                                    borderRadius: '6px',
                                    border: isTop3 ? '2px solid #66c0f4' : '2px solid #2a475e',
                                }}
                            />

                            {/* Username */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <span
                                    style={{
                                        fontSize: isTop3 ? '20px' : '17px',
                                        fontWeight: isTop3 ? '700' : '600',
                                        color: '#c7d5e0',
                                        marginBottom: '2px',
                                    }}
                                >
                                    {user.username}
                                </span>
                                <span style={{ fontSize: '12px', color: '#8f98a0', fontWeight: '600' }}>
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
                                    padding: '6px 14px',
                                    borderRadius: '4px',
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: isTop3 ? '16px' : '14px',
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

            {/* User Position (if >10) */}
            {requestingUser && requestingUser.rank > 10 && (
                <div style={{ display: 'flex', marginTop: '20px', paddingTop: '18px', borderTop: '1px solid #2a475e' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#16202d',
                            padding: '12px 18px',
                            borderRadius: '6px',
                            gap: '14px',
                            flex: 1,
                            border: '1px solid #66c0f4',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#8f98a0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}
                        >
                            Sua posição:
                        </span>
                        <span style={{ fontSize: '18px', fontWeight: '700', color: '#66c0f4' }}>
                            #{requestingUser.rank}
                        </span>
                        <span style={{ fontSize: '13px', color: '#c7d5e0', fontWeight: '600' }}>
                            Nível {requestingUser.level} • {requestingUser.xpTotal.toLocaleString()} XP
                        </span>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
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
