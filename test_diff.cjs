require('ts-node').register();
const { DiffUtils } = require('./packages/core/src/renderer/services/ai/orchestrator/task-runtime/artifact/utils/DiffUtils.ts');

console.log(DiffUtils.computeLineHunks('line 1\nline 2\nline 3\nline 4\nline 5', 'line 1\nline 2\nline 3\nCHANGED 4\nline 5'));
