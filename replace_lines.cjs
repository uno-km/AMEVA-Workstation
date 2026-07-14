const fs = require('fs');

const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');
const replacementLines = fs.readFileSync('block.txt', 'utf8').split('\n');

let startIdx = lines.findIndex(l => l.includes('name: BUILTIN_TOOL_NAMES.APPLY_PATCH')) - 1;
let endIdx = lines.findIndex(l => l.includes('[TOOL: list_dir]')) - 1;

if (startIdx !== -2 && endIdx !== -2) {
  lines.splice(startIdx, endIdx - startIdx, ...replacementLines, '');
  fs.writeFileSync(file, lines.join('\n'));
  console.log("Successfully replaced block using array splice without string replace bugs.");
} else {
  console.log("Could not find start/end indices", startIdx, endIdx);
}
