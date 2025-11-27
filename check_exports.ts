import * as Discord from 'discord.js';

console.log('Available exports:', Object.keys(Discord).filter(k => k.includes('Builder') || k.includes('Component')));
