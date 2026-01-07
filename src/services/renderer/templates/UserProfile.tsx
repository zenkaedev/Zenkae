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
                    ? `linear-gradient(rgba(10,10,20,0.85), rgba(20,20,40,0.95)), url(${bannerUrl})`
                    : 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                padding: '48px',
                position: 'relative',
            }}
        >
            {/* Header com Avatar - Clean e Espaçoso */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '48px' }}>
                <img
                    src={avatarUrl}
                    style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50px',
                        border: `3px solid rgba(255,255,255,0.3)`,
                        marginRight: '28px',
                    }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                        style={{
                            fontSize: '42px',
                            fontWeight: '700',
                            color: '#fff',
                            marginBottom: '6px',
                            letterSpacing: '-0.5px',
                        }}
                    >
                        {username}
                    </span>
                    <span
                        style={{
                            fontSize: '24px',
                            color: 'rgba(255,255,255,0.7)',
                            fontWeight: '400',
                        }}
                    >
                        Nível {level}
                    </span>
                </div>
            </div>

            {/* Barra de XP - Glass Card */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    padding: '28px',
                    borderRadius: '16px',
                    marginBottom: '40px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)', // Não funciona no Satori, mas deixa pro futuro
                }}
            >
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '14px', fontWeight: '500' }}>
                    PRÓXIMO NÍVEL
                </span>

                {/* Barra de progresso CSS smooth */}
                <div style={{
                    display: 'flex',
                    width: '100%',
                    height: '12px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    marginBottom: '10px',
                }}>
                    <div style={{
                        width: `${Math.min(100, Math.max(0, xpProgress))}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)`,
                        borderRadius: '6px',
                    }} />
                </div>

                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end', fontWeight: '500' }}>
                    {Math.round(xpProgress)}%
                </span>
            </div>

            {/* Grid de Stats - Glass Cards Clean */}
            <div
                style={{
                    display: 'flex',
                    gap: '20px',
                    marginBottom: '24px',
                }}
            >
                {/* Mensagens */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        padding: '28px 20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.12)',
                    }}
                >
                    <span style={{ fontSize: '20px', marginBottom: '12px' }}>💬</span>
                    <span style={{ fontSize: '36px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                        {messageCount.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Mensagens
                    </span>
                </div>

                {/* Voz */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        padding: '28px 20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.12)',
                    }}
                >
                    <span style={{ fontSize: '20px', marginBottom: '12px' }}>🎤</span>
                    <span style={{ fontSize: '36px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                        {voiceHours}h
                    </span>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Tempo em Voz
                    </span>
                </div>

                {/* Membro desde */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        padding: '28px 20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.12)',
                    }}
                >
                    <span style={{ fontSize: '20px', marginBottom: '12px' }}>📅</span>
                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                        {memberSince}
                    </span>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Membro desde
                    </span>
                </div>
            </div>

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
