import React from 'react';

interface LeaderboardProps {
    users: {
        rank: number;
        username: string;
        level: number;
        xpProgress: number; // 0 to 100
        avatarUrl: string;
    }[];
    guildName: string;
    page: number;
}

export const FerrariLeaderboard: React.FC<LeaderboardProps> = ({ users, guildName, page }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1b1e', // Darker background
            backgroundImage: 'linear-gradient(135deg, #1a1b1e 0%, #0f1012 100%)',
            padding: '30px',
            fontFamily: 'Inter, sans-serif',
            color: 'white',
        }}>
            {/* Header with Glassmorphism */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '25px',
                padding: '15px 25px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '28px', marginRight: '15px' }}>🏆</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '22px', fontWeight: 800, background: 'linear-gradient(90deg, #fff, #a5a6f6)', backgroundClip: 'text', color: 'transparent' }}>
                            LEADERBOARD
                        </span>
                        <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>
                            {guildName} • Página {page}
                        </span>
                    </div>
                </div>
                <div style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                    color: '#a78bfa',
                    fontSize: '12px',
                    fontWeight: 'bold'
                }}>
                    GLOBAL RANKING
                </div>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {users.map((user) => (
                    <div key={user.rank} style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '12px 20px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.03)',
                    }}>
                        {/* Rank Badge */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            marginRight: '15px',
                            backgroundColor: user.rank === 1 ? 'rgba(255, 215, 0, 0.15)' :
                                user.rank === 2 ? 'rgba(192, 192, 192, 0.15)' :
                                    user.rank === 3 ? 'rgba(205, 127, 50, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: user.rank === 1 ? '#FFD700' :
                                user.rank === 2 ? '#C0C0C0' :
                                    user.rank === 3 ? '#CD7F32' : '#9ca3af',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            border: `1px solid ${user.rank === 1 ? 'rgba(255, 215, 0, 0.3)' :
                                user.rank === 2 ? 'rgba(192, 192, 192, 0.3)' :
                                    user.rank === 3 ? 'rgba(205, 127, 50, 0.3)' : 'transparent'}`
                        }}>
                            {user.rank}
                        </div>

                        {/* Avatar */}
                        <img
                            src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                            width="48"
                            height="48"
                            style={{
                                borderRadius: '50%',
                                marginRight: '15px',
                                border: `2px solid ${user.rank === 1 ? '#FFD700' :
                                    user.rank === 2 ? '#C0C0C0' :
                                        user.rank === 3 ? '#CD7F32' : '#2B2D31'}`
                            }}
                        />

                        {/* User Info & Bar */}
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                                    {user.username}
                                </span>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#a5a6f6' }}>
                                    Lvl {user.level}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                {/* Track */}
                                <div style={{
                                    display: 'flex',
                                    height: '8px',
                                    flex: 1,
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    marginRight: '12px'
                                }}>
                                    {/* Gradient Bar with Glow */}
                                    <div style={{
                                        width: `${user.xpProgress}%`,
                                        height: '100%',
                                        backgroundImage: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)', // Violet to Blue
                                        borderRadius: '4px',
                                        boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)' // Soft glow
                                    }}></div>
                                </div>
                                <span style={{ fontSize: '12px', color: '#6b7280', width: '35px', textAlign: 'right' }}>
                                    {Math.floor(user.xpProgress)}%
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
