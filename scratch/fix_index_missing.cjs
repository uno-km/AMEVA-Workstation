const fs = require('fs');

let content = fs.readFileSync('src/main/index.ts', 'utf8');

// Add import if not present
if (!content.includes('llmProcessManager.js')) {
  content = content.replace(
    "import { CollabServerManager } from './services/collabServer.js'",
    "import { CollabServerManager } from './services/collabServer.js'\nimport { LLMProcessManager } from './services/llmProcessManager.js'"
  );
}

// Replace remaining startLlamaServerWithFallback
content = content.replace(/(?<!LLMProcessManager\.)startLlamaServerWithFallback\b/g, 'LLMProcessManager.startLlamaServerWithFallback');

// Replace remaining broadcastLog
content = content.replace(/(?<!LLMProcessManager\.)broadcastLog\b/g, 'LLMProcessManager.broadcastLog');

// Replace remaining serverPort
content = content.replace(/(?<!LLMProcessManager\.)serverPort\b/g, 'LLMProcessManager.serverPort');

fs.writeFileSync('src/main/index.ts', content, 'utf8');
console.log('Fixed missing LLMProcessManager calls in index.ts');
