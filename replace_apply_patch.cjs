const fs = require('fs');

const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');
const replacementBlock = fs.readFileSync('block.txt', 'utf8');

const lines = content.split('\n');
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('name: BUILTIN_TOOL_NAMES.APPLY_PATCH')) {
    startIdx = i - 1; 
  }
  if (startIdx !== -1 && i > startIdx && lines[i].includes('/*') && lines[i+1] && lines[i+1].includes('[TOOL: list_dir]')) {
    endIdx = i;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx, replacementBlock);
  fs.writeFileSync(file, lines.join('\n'));
  console.log("Replaced APPLY_PATCH properly");
} else {
  console.log("Could not find start or end block", startIdx, endIdx);
}
