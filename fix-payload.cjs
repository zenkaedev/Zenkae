// Script para corrigir panel.ts
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/modules/matchmaking/panel.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences
content = content.replace(/const container = renderPartyContainer/g, 'const payload = renderPartyContainer');
content = content.replace(/content: container,\s+components: buttons/g, '...payload,\n        components: [...(payload.components || []), ...buttons]');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed panel.ts!');
