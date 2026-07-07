const fs = require('fs');

const orig = fs.readFileSync('AIPanel_original.tsx', 'utf-8');

// We want to find exactly what was in getContextWithRAG and other handlers
const ragMatch = orig.match(/const getContextWithRAG = [\s\S]*?return[^\n]*\n\s*}/);
console.log('--- RAG LOGIC ---');
console.log(ragMatch ? ragMatch[0] : 'NOT FOUND');

const activeModeMatch = orig.match(/const getActiveMode = [\s\S]*?return[^\n]*\n\s*}/);
console.log('--- ACTIVE MODE LOGIC ---');
console.log(activeModeMatch ? activeModeMatch[0] : 'NOT FOUND');

const sendMatch = orig.match(/const handleSend = [\s\S]*?setInput\(''\)\n\s*}/);
console.log('--- SEND LOGIC ---');
console.log(sendMatch ? sendMatch[0] : 'NOT FOUND');

const keychainMatch = orig.match(/handleSaveKey[\s\S]*?}/g);
console.log('--- KEYCHAIN LOGIC ---');
console.log(keychainMatch ? keychainMatch.join('\n') : 'NOT FOUND');

