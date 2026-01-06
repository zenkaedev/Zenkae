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
        guildColor = '#FFD700', // Amarelo NoWay padrão
    } = props;

    // Barra de progresso visual
    const barFilled = Math.round((xpProgress / 100) * 20);
    const barEmpty = 20 - barFilled;
    const progressBar = '▓'.repeat(barFilled) + '░'.repeat(barEmpty);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '800px',
                height: '600px',
                backgroundImage: bannerUrl
                    ? `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${bannerUrl})`
                    : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                padding: '40px',
                position: 'relative',
            }}
        >
            {/* Header com Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
                <img
                    src={avatarUrl}
                    style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '60px',
                        border: `4px solid ${guildColor}`,
                        marginRight: '24px',
                    }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                        style={{
                            fontSize: '48px',
                            fontWeight: 'bold',
                            color: '#fff',
                            marginBottom: '8px',
                        }}
                    >
                        {username}
                    </span>
                    <span
                        style={{
                            fontSize: '32px',
                            color: guildColor,
                            fontWeight: 'bold',
                        }}
                    >
                        Nível {level}
                    </span>
                </div>
            </div>

            {/* Barra de XP */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    padding: '20px',
                    borderRadius: '12px',
                    marginBottom: '24px',
                }}
            >
                <span style={{ fontSize: '18px', color: '#aaa', marginBottom: '8px' }}>
                    Progresso para o próximo nível
                </span>
                <span
                    style={{
                        fontSize: '28px',
                        fontFamily: 'monospace',
                        color: guildColor,
                        letterSpacing: '2px',
                    }}
                >
                    {progressBar}
                </span>
                <span style={{ fontSize: '16px', color: '#ccc', marginTop: '4px' }}>
                    {Math.round(xpProgress)}%
                </span>
            </div>

            {/* Grid de Stats */}
            <div
                style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '24px',
                }}
            >
                {/* Mensagens */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '2px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>💬</span>
                    <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>
                        {messageCount.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '14px', color: '#aaa' }}>Mensagens</span>
                </div>

                {/* Voz */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '2px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>🎤</span>
                    <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>
                        {voiceHours}h
                    </span>
                    <span style={{ fontSize: '14px', color: '#aaa' }}>Tempo em Voz</span>
                </div>

                {/* Membro desde */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '2px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>📅</span>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                        {memberSince}
                    </span>
                    <span style={{ fontSize: '14px', color: '#aaa' }}>Membro desde</span>
                </div>
            </div>

            {/* Footer */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '40px',
                    fontSize: '14px',
                    color: '#666',
                }}
            >
                ZenKae Bot
            </div>
        </div>
    );
}
