// Fix script for panel.ts
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/modules/matchmaking/panel.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Change button label
content = content.replace(/setLabel\('➕ Criar Nova PT'\)/g, "setLabel('➕ Criar Nova PT')");

// Fix 2: Fix broken syntax from sed command
content = content.replace(/components: \[nu\]\.\.\.\(payload\.components \|\| \[\]\), \.\.\.buttons\],/g, 'components: [...(payload.components || []), ...buttons],');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed panel.ts successfully!');
