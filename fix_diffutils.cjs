const fs = require('fs');
const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const { DiffUtils } = require('./task-runtime/artifact/utils/DiffUtils');", "");
content = content.replace(/DiffUtils\.computeLineHunks/g, "computeLineHunks");

fs.writeFileSync(file, content);
