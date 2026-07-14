const fs = require('fs');
const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("require('./task-runtime/artifact/utils/DiffUtils').computeLineHunks", "computeLineHunks");
fs.writeFileSync(file, content);
