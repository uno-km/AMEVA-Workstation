const fs = require('fs');

const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
const content = fs.readFileSync(file, 'utf8');
const replacementBlock = fs.readFileSync('block.txt', 'utf8');

const applyPatchStart = content.indexOf("this.register({\n      name: BUILTIN_TOOL_NAMES.APPLY_PATCH");
const nextToolStart = content.indexOf("/*\n     * [TOOL: list_dir]", applyPatchStart);

if (applyPatchStart !== -1 && nextToolStart !== -1) {
  const newContent = content.substring(0, applyPatchStart) + replacementBlock + "\n\n    " + content.substring(nextToolStart);
  fs.writeFileSync(file, newContent);
  console.log("Successfully replaced APPLY_PATCH logic.");
} else {
  console.log("Failed to find boundaries.", applyPatchStart, nextToolStart);
}
