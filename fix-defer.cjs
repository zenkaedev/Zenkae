// Script para adicionar defer em publishTotem
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/modules/matchmaking/panel.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find publishTotem function and add defer after the inCachedGuild check
const search = `export async function publishTotem(inter: ButtonInteraction) {
    if (!inter.inCachedGuild()) return;

    const channel = inter.channel;`;

const replace = `export async function publishTotem(inter: ButtonInteraction) {
    if (!inter.inCachedGuild()) return;

    // Defer imediatamente para evitar timeout
    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = inter.channel;`;

content = content.replace(search, replace);

// Also fix the reply at the end
content = content.replace(
    /await inter\.reply\(\{\s+content: '✅ Totem de Matchmaking publicado com sucesso!',\s+flags: MessageFlags\.Ephemeral,\s+\}\);/,
    `await inter.editReply({\n        content: '✅ Totem de Matchmaking publicado com sucesso!',\n    });`
);

// Fix the error reply
content = content.replace(
    /await inter\.reply\(\{ content: '❌ Use em um canal de texto\.', flags: MessageFlags\.Ephemeral \}\);/,
    `await inter.editReply({ content: '❌ Use em um canal de texto.' });`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed publishTotem defer!');
