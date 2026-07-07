const fs = require('fs');

let content = fs.readFileSync('src/main/index.ts', 'utf8');

// Replace activeLLMProcess references
content = content.replace(/\bactiveLLMProcess\b/g, 'LLMProcessManager.activeLLMProcess');

// Replace findLlamaCli calls where not prefixed
content = content.replace(/(?<!LLMProcessManager\.)findLlamaCli\b/g, 'LLMProcessManager.findLlamaCli');

// Replace findWhisperCli calls where not prefixed
content = content.replace(/(?<!LLMProcessManager\.)findWhisperCli\b/g, 'LLMProcessManager.findWhisperCli');

// Replace forceCleanupLocalLLMProcesses calls where not prefixed
content = content.replace(/(?<!LLMProcessManager\.)forceCleanupLocalLLMProcesses\b/g, 'LLMProcessManager.forceCleanupLocalLLMProcesses');

fs.writeFileSync('src/main/index.ts', content, 'utf8');
console.log('Successfully refactored index.ts LLM calls!');
