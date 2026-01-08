import React from 'react';

interface LeaderboardProps {
    users: {
        rank: number;
        username: string;
        level: number;
        xpProgress: number; // 0 to 100
        avatarUrl: string;
        isTop3: boolean;
    }[];
    guildName: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ users, guildName }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: '#2B2D31', // Discord Dark Embed Background
            padding: '20px',
            fontFamily: 'Inter, sans-serif',
            color: 'white',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '24px', marginRight: '10px' }}>🏆</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>Ranking Global - {guildName}</span>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {users.map((user) => (
                    <div key={user.rank} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

                        {/* Row Header: Rank icon + Level + Name */}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                            <span style={{
                                fontSize: '18px',
                                fontWeight: 'bold',
                                marginRight: '10px',
                                color: user.rank === 1 ? '#FFD700' : user.rank === 2 ? '#C0C0C0' : user.rank === 3 ? '#CD7F32' : '#FFFFFF'
                            }}>
                                {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                            </span>

                            <span style={{ fontSize: '16px', fontWeight: 'bold', marginRight: '5px', color: '#DADCE0' }}>
                                [Nível {user.level}]
                            </span>

                            <span style={{ fontSize: '16px', fontWeight: '600', color: '#FFFFFF' }}>
                                {user.username}
                            </span>
                        </div>

                        {/* Bar Container */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            {/* Progress Bar Track */}
                            <div style={{
                                display: 'flex',
                                height: '12px',
                                flex: 1,
                                backgroundColor: '#1E1F22', // Darker track
                                borderRadius: '6px',
                                overflow: 'hidden',
                                marginRight: '15px'
                            }}>
                                {/* Filled Bar */}
                                <div style={{
                                    width: `${user.xpProgress}%`,
                                    height: '100%',
                                    backgroundColor: '#9B59B6', // Purple similar to reference
                                    borderRadius: '6px'
                                }}></div>
                            </div>

                            {/* Badge Percentage */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px 8px',
                                backgroundColor: '#1E1F22',
                                borderRadius: '4px',
                                minWidth: '45px'
                            }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#FFFFFF' }}>
                                    {Math.floor(user.xpProgress)}%
                                </span>
                            </div>
                        </div>

                        {/* Avatar Overlay for Top 1 (Optional/Creative choice) 
                            Actually reference showed pure list. 
                            Let's keep clean list.
                        */}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #3F4147' }}>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Atualizado em tempo real</span>
            </div>
        </div>
    );
};
