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
            backgroundColor: '#0f1012', // Deep dark background
            padding: '40px',
            fontFamily: 'Inter, sans-serif',
            color: 'white',
        }}>
            {/* Header Card */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '30px',
                padding: '20px 30px',
                backgroundColor: '#1E1F22',
                borderRadius: '16px',
                border: '1px solid #2B2D31',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {/* Icon Box */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '50px',
                        height: '50px',
                        backgroundColor: '#2B2D31',
                        borderRadius: '8px',
                        marginRight: '20px',
                        fontSize: '24px'
                    }}>
                        🏆
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '24px', fontWeight: 700, color: '#A5A6F6', letterSpacing: '1px' }}>
                            LEADERBOARD
                        </span>
                        <span style={{ fontSize: '16px', color: '#9CA3AF' }}>
                            {guildName} • Página {page}
                        </span>
                    </div>
                </div>
                <div style={{
                    padding: '8px 20px',
                    backgroundColor: 'rgba(88, 101, 242, 0.1)',
                    borderRadius: '20px',
                    border: '1px solid rgba(88, 101, 242, 0.3)',
                    color: '#5865F2',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                }}>
                    Global Ranking
                </div>
            </div>

            {/* List of Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {users.map((user) => (
                    <div key={user.rank} style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        height: '80px',
                        padding: '0 25px',
                        backgroundColor: '#1E1F22', // Card Color
                        borderRadius: '24px', // Rounded like reference
                        border: '1px solid #2B2D31',
                    }}>
                        {/* Rank Circle */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '45px',
                            height: '45px',
                            borderRadius: '16px', // Rounded squareish
                            marginRight: '20px',
                            backgroundColor: '#2B2D31',
                            color: user.rank === 1 ? '#FFD700' :
                                user.rank === 2 ? '#C0C0C0' :
                                    user.rank === 3 ? '#CD7F32' : '#9CA3AF',
                            fontSize: '20px',
                            fontWeight: 800,
                        }}>
                            {user.rank}
                        </div>

                        {/* Dot Separator */}
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#4B5563', marginRight: '20px' }}></div>

                        {/* User Info & Bar Container */}
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
                            {/* Top Row: Name | Level (Right) */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                                <span style={{ fontSize: '18px', fontWeight: 600, color: '#F3F4F6' }}>
                                    {user.username}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '14px', color: '#A5A6F6', fontWeight: 600, marginRight: '5px' }}>
                                        Lvl {user.level}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                        {Math.floor(user.xpProgress)}%
                                    </span>
                                </div>
                            </div>

                            {/* Bottom Row: Progress Bar */}
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#2B2D31', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.max(user.xpProgress, 2)}%`, // Min visible width
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)',
                                    borderRadius: '4px'
                                }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
