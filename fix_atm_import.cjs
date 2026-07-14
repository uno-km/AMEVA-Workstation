const fs = require('fs');
const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { DiffUtils } from './task-runtime/artifact/utils/DiffUtils'", "import { DiffUtils } from './task-runtime/artifact/utils/DiffUtils'\nimport { ArtifactTransactionManager } from './task-runtime/artifact/ArtifactTransactionManager'");

fs.writeFileSync(file, content);
