// src/services/renderer/templates/UserProfile.tsx
import React from 'react';

interface UserProfileProps {
    username: string;
    avatarUrl: string;
    bannerUrl?: string;
    level: number;
    xpProgress: number;
    messageCount: number;
    voiceHours: number;
    memberSince: string;
    guildColor: string;
}

// Helper to determine border style based on level
function getLevelStyle(level: number) {
    if (level >= 100) return { color: '#ff0000', glow: '0 0 15px #ff0000', border: '3px solid #ff0000' }; // Mythic (Red/Glow)
    if (level >= 80) return { color: '#ffd700', glow: '0 0 10px #ffd700', border: '3px solid #ffd700' }; // Legendary (Gold)
    if (level >= 50) return { color: '#a335ee', glow: '0 0 8px #a335ee', border: '3px solid #a335ee' }; // Epic (Purple)
    if (level >= 30) return { color: '#66c0f4', glow: '0 0 5px #66c0f4', border: '3px solid #66c0f4' }; // Rare (Blue)
    if (level >= 10) return { color: '#5cff5c', glow: '0 0 5px #5cff5c', border: '3px solid #5cff5c' }; // Uncommon (Green)
    return { color: '#c7d5e0', glow: 'none', border: '3px solid #c7d5e0' }; // Basic (Grey)
}

export function UserProfile(props: UserProfileProps) {
    const {
        username,
        avatarUrl,
        bannerUrl,
        level,
        xpProgress,
        messageCount,
        voiceHours,
        memberSince,
    } = props;

    const style = getLevelStyle(level);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '800px',
                height: '600px',
                background: '#1b2838',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                // Dynamic Border for the Card Container
                border: style.border,
                boxShadow: style.glow !== 'none' ? `inset ${style.glow}` : 'none',
            }}
        >
            {/* Banner Background - Right Side with Fade */}
            {bannerUrl && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '450px',
                        height: '220px',
                        backgroundImage: `linear-gradient(to right, rgba(27,40,56,1) 0%, rgba(27,40,56,0.4) 35%, rgba(27,40,56,0) 100%), url(${bannerUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                    }}
                />
            )}

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '32px', flex: 1 }}>
                {/* Header - Avatar + Name */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
                    <img
                        src={avatarUrl}
                        style={{
                            width: '90px',
                            height: '90px',
                            borderRadius: '8px',
                            marginRight: '20px',
                            // Dynamic Border for Avatar
                            border: style.border,
                            boxShadow: style.glow,
                        }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '36px', fontWeight: '700', color: '#c7d5e0', marginBottom: '4px' }}>
                            {username}
                        </span>
                        <span style={{ fontSize: '18px', color: style.color, fontWeight: '600' }}>
                            Nível {level}
                        </span>
                    </div>
                </div>

                {/* XP Progress */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#16202d',
                        padding: '20px',
                        borderRadius: '6px',
                        marginBottom: '20px',
                    }}
                >
                    <span
                        style={{
                            fontSize: '11px',
                            color: '#8f98a0',
                            textTransform: 'uppercase',
                            marginBottom: '10px',
                            fontWeight: '600',
                            letterSpacing: '1px',
                        }}
                    >
                        Próximo Nível
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            width: '100%',
                            height: '8px',
                            background: '#0e1419',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '8px',
                        }}
                    >
                        <div
                            style={{
                                width: `${Math.min(100, Math.max(0, xpProgress))}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, ${style.color} 0%, ${style.color} 100%)`, // Matches border color
                                borderRadius: '4px',
                            }}
                        />
                    </div>
                    <span style={{ fontSize: '12px', color: style.color, alignSelf: 'flex-end', fontWeight: '600' }}>
                        {Math.round(xpProgress)}%
                    </span>
                </div>

                {/* Stats Grid */}
                <div style={{ display: 'flex', gap: '14px', flex: 1 }}>
                    {/* Mensagens */}
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#16202d',
                            padding: '20px 16px',
                            borderRadius: '6px',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '10px',
                                marginBottom: '10px',
                                color: '#66c0f4',
                                fontWeight: '700',
                                letterSpacing: '1px',
                                textTransform: 'uppercase',
                            }}
                        >
                            Mensagens
                        </span>
                        <span style={{ fontSize: '28px', fontWeight: '700', color: '#c7d5e0' }}>
                            {messageCount.toLocaleString()}
                        </span>
                    </div>

                    {/* Tempo em Call */}
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#16202d',
                            padding: '20px 16px',
                            borderRadius: '6px',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '10px',
                                marginBottom: '10px',
                                color: '#66c0f4',
                                fontWeight: '700',
                                letterSpacing: '1px',
                                textTransform: 'uppercase',
                            }}
                        >
                            Tempo em Call
                        </span>
                        <span style={{ fontSize: '28px', fontWeight: '700', color: '#c7d5e0' }}>
                            {voiceHours}h
                        </span>
                    </div>

                    {/* No Discord */}
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#16202d',
                            padding: '20px 16px',
                            borderRadius: '6px',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '10px',
                                marginBottom: '10px',
                                color: '#66c0f4',
                                fontWeight: '700',
                                letterSpacing: '1px',
                                textTransform: 'uppercase',
                            }}
                        >
                            No Discord
                        </span>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#c7d5e0' }}>
                            {memberSince}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
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
        </div>
    );
}
