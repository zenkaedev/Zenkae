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

    // Split top 3 for podium and rest for list
    const podiumUsers = topUsers.slice(0, 3);
    const listUsers = topUsers.slice(3);

    // Helper to get podium order: 2nd, 1st, 3rd (Silver, Gold, Bronze)
    // Indexes in podiumUsers: 0=1st, 1=2nd, 2=3rd
    // Render order for visual: [1, 0, 2] -> 2nd, 1st, 3rd
    const renderOrder = [1, 0, 2];

    const getPlaceColor = (rank: number) => {
        if (rank === 1) return '#ffd700'; // Gold
        if (rank === 2) return '#c0c0c0'; // Silver
        if (rank === 3) return '#cd7f32'; // Bronze
        return '#66c0f4';
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '900px',
                minHeight: '1200px', // Allow growth if needed
                height: '100%',
                background: '#101822', // Deep dark theme
                padding: '40px',
                borderRadius: '20px',
                fontFamily: 'sans-serif',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '40px',
                    borderBottom: '1px solid #1b2838',
                    paddingBottom: '20px',
                    width: '100%',
                }}
            >
                <span
                    style={{
                        fontSize: '14px',
                        color: '#66c0f4',
                        textTransform: 'uppercase',
                        fontWeight: '800',
                        letterSpacing: '3px',
                        marginBottom: '8px',
                    }}
                >
                    Leaderboard
                </span>
                <span style={{ fontSize: '48px', fontWeight: '800', color: '#ffffff', textShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    {guildName}
                </span>
            </div>

            {/* PODIUM SECTION */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    gap: '20px',
                    marginBottom: '40px',
                    width: '100%',
                    height: '320px', // Fixed height for podium area
                }}
            >
                {renderOrder.map((idx) => {
                    const user = podiumUsers[idx];
                    if (!user) return null; // Handle cases with < 3 users

                    const isFirst = user.rank === 1;
                    const placeColor = getPlaceColor(user.rank);
                    const scale = isFirst ? 1.1 : 0.9;
                    const zIndex = isFirst ? 10 : 1;

                    return (
                        <div
                            key={user.userId}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '220px',
                                background: '#1b2838',
                                borderRadius: '16px 16px 0 0', // Rounded top, flat bottom look
                                padding: '20px',
                                borderTop: `4px solid ${placeColor}`,
                                transform: `scale(${scale})`,
                                zIndex: zIndex,
                                boxShadow: isFirst ? `0 0 30px ${placeColor}40` : 'none',
                                position: 'relative',
                                height: isFirst ? '300px' : '260px',
                                justifyContent: 'flex-end', // Push content up/down
                            }}
                        >
                            {/* Crown for #1 */}
                            {isFirst && (
                                <div style={{
                                    display: 'flex', // Satori fix
                                    position: 'absolute',
                                    top: '-40px',
                                    fontSize: '50px',
                                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))'
                                }}>
                                    👑
                                </div>
                            )}

                            {/* Avatar */}
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                border: `4px solid ${placeColor}`,
                                overflow: 'hidden',
                                marginBottom: '16px',
                                boxShadow: `0 0 15px ${placeColor}40`,
                                display: 'flex',
                            }}>
                                <img src={user.avatarUrl} style={{ width: '100%', height: '100%' }} />
                            </div>

                            {/* Info */}
                            <span style={{
                                fontSize: '24px',
                                fontWeight: '800',
                                color: '#ffffff',
                                marginBottom: '4px',
                                textAlign: 'center',
                                lineHeight: '1.2'
                            }}>
                                {user.username}
                            </span>
                            <span style={{
                                fontSize: '14px',
                                color: '#8f98a0',
                                fontWeight: '600',
                                marginBottom: '12px'
                            }}>
                                Nível {user.level} (Top {user.rank})
                            </span>

                            <div style={{
                                display: 'flex', // Satori fix
                                background: '#101822',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                color: placeColor,
                                fontWeight: '700',
                                fontSize: '14px',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {user.xpTotal.toLocaleString()} XP
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* LIST SECTION (Rest of users) */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flex: 1,
                width: '100%'
            }}>
                {listUsers.map((user) => (
                    <div
                        key={user.userId}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#16202d',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            gap: '20px',
                            border: '1px solid #1b2838',
                        }}
                    >
                        {/* Rank Number */}
                        <div style={{
                            display: 'flex',
                            width: '40px',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#8f98a0'
                        }}>
                            #{user.rank}
                        </div>

                        {/* Avatar */}
                        <img
                            src={user.avatarUrl}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                border: '1px solid #2a475e'
                            }}
                        />

                        {/* Name & XP */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: '#c7d5e0' }}>
                                {user.username}
                            </span>
                            <span style={{ fontSize: '12px', color: '#66c0f4', fontWeight: '500' }}>
                                {user.xpTotal.toLocaleString()} XP
                            </span>
                        </div>

                        {/* Level Badge Side */}
                        <div style={{
                            display: 'flex',
                            background: '#1b2838',
                            padding: '6px 16px',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '14px'
                        }}>
                            LVL {user.level}
                        </div>
                    </div>
                ))}
            </div>

            {/* REQUESTING USER SELF RANK (if distinct) */}
            {/* Note: If user is already in top 10, this might be redundant if not handled carefully, 
                but logic in rank.ts handles logic to only pass this if outside top 10. */}
            {requestingUser && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '2px dashed #2a475e'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#1b2838', // Highlighted bg
                        padding: '12px 24px',
                        borderRadius: '12px',
                        gap: '20px',
                        border: '1px solid #66c0f4',
                        boxShadow: '0 0 15px rgba(102, 192, 244, 0.1)'
                    }}>
                        {/* Rank Number */}
                        <div style={{
                            display: 'flex',
                            width: '40px',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#66c0f4'
                        }}>
                            #{requestingUser.rank}
                        </div>

                        {/* Avatar */}
                        <img
                            src={requestingUser.avatarUrl}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                border: '1px solid #66c0f4'
                            }}
                        />

                        {/* Name & XP */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
                                {requestingUser.username} <span style={{ fontSize: '12px', color: '#66c0f4', marginLeft: '8px' }}>(Você)</span>
                            </span>
                            <span style={{ fontSize: '12px', color: '#66c0f4', fontWeight: '500' }}>
                                {requestingUser.xpTotal.toLocaleString()} XP
                            </span>
                        </div>

                        {/* Level Badge Side */}
                        <div style={{
                            display: 'flex',
                            background: '#66c0f4',
                            padding: '6px 16px',
                            borderRadius: '6px',
                            color: '#101822',
                            fontWeight: '800',
                            fontSize: '14px'
                        }}>
                            LVL {requestingUser.level}
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', opacity: 0.6 }}>
                    <span style={{ fontSize: '12px', color: '#8f98a0', marginRight: '8px' }}>Atualizado em tempo real</span>
                </div>
                <span style={{ fontSize: '12px', color: '#2a475e', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    ZENKAE RANKING
                </span>
            </div>
        </div>
    );
}
