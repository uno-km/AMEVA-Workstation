const fs = require('fs');
let content = fs.readFileSync('src/renderer/components/ai-panel/chat-list/MessageBubble.tsx', 'utf-8');
content = content.replace(/\\`/g, '`');
fs.writeFileSync('src/renderer/components/ai-panel/chat-list/MessageBubble.tsx', content, 'utf-8');
console.log('Fixed backticks without corrupting utf-8');
