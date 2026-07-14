const fs = require('fs');
const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("changedRanges = hunks.map((h: any) => `L${h.oldStartLine}-L${h.oldEndLine}`);", "changedRanges = hunks.map((h: any) => `L${h.oldStartLine}-L${h.oldEndLine}`); console.log('HUNKS:', JSON.stringify(hunks), '\\nOLD:', JSON.stringify(currentContent), '\\nNEW:', JSON.stringify(newContent));");

fs.writeFileSync(file, content);
