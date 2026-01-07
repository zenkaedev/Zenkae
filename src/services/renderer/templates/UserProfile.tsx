// src/services/renderer/templates/UserProfile.tsx
import React from 'react';

export interface UserProfileProps {
    username: string;
    avatarUrl: string;
    bannerUrl?: string;
    level: number;
    xpProgress: number;
    currentXP: number;
    requiredXP: number;
    messageCount: number;
    voiceHours: number;
    memberSince: string;
    guildColor: string;
    roleName: string;
    roleColor: string;
}

// Helper to determine indicator color based on level
function getLevelColor(level: number) {
    if (level >= 100) return '#ff0000'; // Mythic
    if (level >= 80) return '#ffd700'; // Legendary
    if (level >= 50) return '#a335ee'; // Epic
    if (level >= 30) return '#66c0f4'; // Rare
    if (level >= 10) return '#5cff5c'; // Uncommon
    return '#66c0f4'; // Default Blue
}

export function UserProfile(props: UserProfileProps) {
    const {
        username,
        avatarUrl,
        bannerUrl,
        level,
        xpProgress,
        currentXP,
        requiredXP,
        messageCount,
        voiceHours,
        memberSince,
        roleName,
        roleColor,
    } = props;

    const levelColor = getLevelColor(level);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '800px',
                height: '600px',
                background: '#101822',
                borderRadius: '20px',
                overflow: 'hidden',
                position: 'relative',
                fontFamily: 'sans-serif',
            }}
        >
            {/* 1. TOP BANNER AREA */}
            <div
                style={{
                    display: 'flex', // Satori required
                    flexDirection: 'column', // Stack children
                    width: '100%',
                    height: '240px',
                    position: 'relative',
                    background: '#1b2838',
                }}
            >
                {bannerUrl ? (
                    <img
                        src={bannerUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #1b2838, #2a475e)' }} />
                )}
                {/* Gradient Overlay */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: '140px',
                        backgroundImage: 'linear-gradient(to bottom, transparent 0%, #101822 100%)',
                    }}
                />
            </div>

            {/* 2. PROFILE HEADER (Floating) */}
            {/* Note: Satori layers by document order. Since this is after Banner, 
                it renders ON TOP. Negative margin pulls it up. No zIndex needed. */}
            <div style={{
                display: 'flex', // Satori required
                flexDirection: 'column',
                padding: '0 40px',
                marginTop: '-80px',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>

                    {/* AVATAR + NAME GROUP */}
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        {/* Avatar Container */}
                        <div
                            style={{
                                display: 'flex', // Satori required
                                width: '140px',
                                height: '140px',
                                borderRadius: '50%',
                                padding: '6px',
                                background: '#101822',
                                position: 'relative',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {/* Level Ring Border */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    borderRadius: '50%',
                                    border: `3px solid ${levelColor}`,
                                    boxShadow: `0 0 15px ${levelColor}40`,
                                }}
                            />

                            <img
                                src={avatarUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                }}
                            />

                            {/* Level Badge Pill */}
                            <div
                                style={{
                                    display: 'flex', // Satori required
                                    position: 'absolute',
                                    bottom: '-5px',
                                    background: '#1b2838',
                                    border: `2px solid ${levelColor}`,
                                    borderRadius: '20px',
                                    padding: '4px 12px',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                                }}
                            >
                                <span style={{ color: levelColor, fontSize: '14px', fontWeight: '800' }}>
                                    LVL {level}
                                </span>
                            </div>
                        </div>

                        {/* User Info Text */}
                        <div style={{
                            display: 'flex',        // Satori required
                            flexDirection: 'column', // Stack Title and Role
                            marginLeft: '24px',
                            marginBottom: '15px'
                        }}>
                            <h1 style={{
                                margin: 0,
                                fontSize: '36px',
                                fontWeight: '800',
                                color: '#ffffff',
                                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                lineHeight: '1',
                                marginBottom: '8px'
                            }}>
                                {username}
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Role Badge */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: `${roleColor}15`,
                                    border: `1px solid ${roleColor}30`,
                                }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: roleColor, marginRight: '8px', boxShadow: `0 0 6px ${roleColor}` }} />
                                    <span style={{ color: roleColor, fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {roleName}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* XP Progress Section (Right) */}
                    <div style={{
                        display: 'flex',         // Satori required
                        flexDirection: 'column', // Stack children
                        marginBottom: '20px',
                        textAlign: 'right',
                        minWidth: '200px',
                        alignItems: 'flex-end', // Align right
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', marginBottom: '6px' }}>
                            <span style={{ color: '#ffffff', fontWeight: '800', fontSize: '24px', marginRight: '4px' }}>
                                {Math.round(xpProgress)}%
                            </span>
                            <span style={{ fontSize: '12px', color: '#8f98a0', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                to next level
                            </span>
                        </div>
                        <div style={{ display: 'flex', color: '#66c0f4', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
                            <span style={{ color: '#fff' }}>{currentXP.toLocaleString()}</span>
                            <span style={{ margin: '0 4px', color: '#8f98a0' }}>/</span>
                            <span style={{ color: '#8f98a0' }}>{requiredXP.toLocaleString()} XP</span>
                        </div>

                        {/* XP Bar */}
                        <div style={{ width: '100%', height: '8px', background: '#090c10', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                            <div
                                style={{
                                    height: '100%',
                                    width: `${Math.min(100, Math.max(0, xpProgress))}%`,
                                    background: `linear-gradient(90deg, ${levelColor} 0%, ${levelColor}dd 100%)`,
                                    borderRadius: '4px',
                                    boxShadow: `0 0 10px ${levelColor}50`
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. STATS GRID */}
            <div style={{
                display: 'flex',
                padding: '0 40px',
                marginTop: '40px',
                gap: '20px',
                flex: 1
            }}>

                {/* Messages Card */}
                <div style={{ ...statsBoxStyle, borderColor: '#1b2838' }}>
                    <div style={{ ...iconBoxStyle, color: '#66c0f4' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={statsLabelStyle}>Mensagens</span>
                        <span style={statsValueStyle}>{messageCount.toLocaleString()}</span>
                    </div>
                </div>

                {/* Voice Card */}
                <div style={{ ...statsBoxStyle, borderColor: '#1b2838' }}>
                    <div style={{ ...iconBoxStyle, color: '#66c0f4' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={statsLabelStyle}>Tempo em Call</span>
                        <span style={statsValueStyle}>{voiceHours}h</span>
                    </div>
                </div>

                {/* Join Date Card */}
                <div style={{ ...statsBoxStyle, borderColor: '#1b2838' }}>
                    <div style={{ ...iconBoxStyle, color: '#66c0f4' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={statsLabelStyle}>Membro Desde</span>
                        <span style={statsValueStyle}>{memberSince}</span>
                    </div>
                </div>
            </div>

            {/* 4. FOOTER / DECORATION */}
            <div style={{
                display: 'flex',
                padding: '0 40px 30px',
                justifyContent: 'space-between',
                alignItems: 'flex-end'
            }}>
                {/* Fake Achievements Placeholder */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    opacity: 0.5,
                    background: '#16202d',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #1b2838'
                }}>
                    <span style={{ fontSize: '16px' }}>🏆</span>
                    <span style={{ fontSize: '12px', color: '#8f98a0', fontWeight: '600' }}>Conquistas em breve</span>
                </div>

                <span style={{ fontSize: '12px', color: '#2a475e', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    ZENKAE PROFILE
                </span>
            </div>
        </div>
    );
}

// SHARED STYLES
const statsBoxStyle: React.CSSProperties = {
    flex: 1,
    background: '#16202d',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
};

const iconBoxStyle: React.CSSProperties = {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    background: '#101822',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)',
};

const statsLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#8f98a0',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    display: 'block',
    marginBottom: '4px',
};

const statsValueStyle: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: '800',
    color: '#ffffff',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
};
