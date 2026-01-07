// src/services/renderer/templates/UserProfile.tsx
import React from 'react';

interface UserProfileProps {
    username: string;
    avatarUrl: string;
    bannerUrl?: string;
    level: number;
    xpProgress: number; // 0-100
    messageCount: number;
    voiceHours: number;
    memberSince: string;
    guildColor: string;
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

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '800px',
                height: '600px',
                background: '#1b2838', // Steam dark blue-gray
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Banner Background - Aligned Right com Fade */}
            {bannerUrl && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '500px',
                        height: '250px',
                        backgroundImage: `linear-gradient(to right, rgba(27,40,56,1) 0%, rgba(27,40,56,0.3) 40%, rgba(27,40,56,0) 100%), url(${bannerUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                    }}
                />
            )}

            {/* Content Container */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '32px',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Header - Avatar + Name + Level */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
                    <img
                        src={avatarUrl}
                        style={{
                            width: '90px',
                            height: '90px',
                            borderRadius: '8px',
                            border: '3px solid #c7d5e0',
                            marginRight: '20px',
                        }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                            style={{
                                fontSize: '36px',
                                fontWeight: '700',
                                color: '#c7d5e0',
                                marginBottom: '4px',
                            }}
                        >
                            {username}
                        </span>
                        <span
                            style={{
                                fontSize: '18px',
                                color: '#66c0f4', // Steam blue
                                fontWeight: '600',
                            }}
                        >
                            Nível {level}
                        </span>
                    </div>
                </div>

                {/* XP Progress Section */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#16202d',
                        padding: '20px',
                        borderRadius: '6px',
                        marginBottom: '24px',
                    }}
                >
                    <span
                        style={{
                            fontSize: '12px',
                            color: '#8f98a0',
                            textTransform: 'uppercase',
                            marginBottom: '10px',
                            fontWeight: '600',
                            letterSpacing: '1px',
                        }}
                    >
                        Próximo Nível
                    </span>

                    {/* Progress Bar */}
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
                                background: 'linear-gradient(90deg, #66c0f4 0%, #2a98d5 100%)', // Steam blue gradient
                                borderRadius: '4px',
                            }}
                        />
                    </div>

                    <span
                        style={{
                            fontSize: '12px',
                            color: '#66c0f4',
                            alignSelf: 'flex-end',
                            fontWeight: '600',
                        }}
                    >
                        {Math.round(xpProgress)}%
                    </span>
                </div>

                {/* Stats Grid */}
                <div
                    style={{
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '16px',
                    }}
                >
                    {/* Mensagens */}
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#16202d',
                            padding: '24px 20px',
                            borderRadius: '6px',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: '28px', marginBottom: '8px', color: '#c7d5e0' }}>
                            💬
                        </span>
                        <span
                            style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                color: '#c7d5e0',
                                marginBottom: '4px',
                            }}
                        >
                            {messageCount.toLocaleString()}
                        </span>
                        <span
                            style={{
                                fontSize: '11px',
                                color: '#8f98a0',
                                textTransform: 'uppercase',
                                fontWeight: '600',
                                letterSpacing: '0.5px',
                            }}
                        >
                            Mensagens
                        </span>
                    </div>

                    {/* Tempo em Voz */}
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#16202d',
                            padding: '24px 20px',
                            borderRadius: '6px',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: '28px', marginBottom: '8px', color: '#c7d5e0' }}>
                            🎧
                        </span>
                        <span
                            style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                color: '#c7d5e0',
                                marginBottom: '4px',
                            }}
                        >
                            {voiceHours}h
                        </span>
                        <span
                            style={{
                                fontSize: '11px',
                                color: '#8f98a0',
                                textTransform: 'uppercase',
                                fontWeight: '600',
                                letterSpacing: '0.5px',
                            }}
                        >
                            Tempo em Call
                        </span>
                    </div>

                    {/* Membro Desde */}
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#16202d',
                            padding: '24px 20px',
                            borderRadius: '6px',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: '28px', marginBottom: '8px', color: '#c7d5e0' }}>
                            ⏰
                        </span>
                        <span
                            style={{
                                fontSize: '18px',
                                fontWeight: '700',
                                color: '#c7d5e0',
                                marginBottom: '4px',
                            }}
                        >
                            {memberSince}
                        </span>
                        <span
                            style={{
                                fontSize: '11px',
                                color: '#8f98a0',
                                textTransform: 'uppercase',
                                fontWeight: '600',
                                letterSpacing: '0.5px',
                            }}
                        >
                            No Discord
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '8px',
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
        </div>
    );
}
