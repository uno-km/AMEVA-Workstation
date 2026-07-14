const fs = require('fs');
const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { computeLineHunks } from './task-runtime/artifact/utils/DiffUtils'", "import { DiffUtils } from './task-runtime/artifact/utils/DiffUtils'");
content = content.replace(/computeLineHunks/g, "DiffUtils.computeLineHunks");

fs.writeFileSync(file, content);
