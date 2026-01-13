// Fix urgente - adicionar leaderRole ao input
const fs = require('fs');
const path = require('path');

const panelPath = path.join(__dirname, 'src/modules/matchmaking/panel.ts');
let content = fs.readFileSync(panelPath, 'utf8');

// Procurar onde está o CreatePartyInput e adicionar leaderRole se não existir
if (!content.includes('leaderRole: normalizedRole,')) {
    console.log('Adicionando leaderRole ao input...');

    // Tentar trocar a linha exata
    content = content.replace(
        `        leaderId: inter.user.id,
        title,`,
        `        leaderId: inter.user.id,
        leaderRole: normalizedRole,
        title,`
    );
}

fs.writeFileSync(panelPath, content, 'utf8');
console.log('✅ leaderRole adicionado ao input!');
