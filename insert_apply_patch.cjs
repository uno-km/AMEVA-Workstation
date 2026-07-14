const fs = require('fs');

const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');
const replacementBlock = fs.readFileSync('block.txt', 'utf8');

const listDirStart = content.indexOf("/*\n     * [TOOL: list_dir]");

if (listDirStart !== -1) {
  content = content.substring(0, listDirStart) + replacementBlock + "\n\n    " + content.substring(listDirStart);
  fs.writeFileSync(file, content);
  console.log("Inserted before list_dir successfully.");
} else {
  // Try to find BUILTIN_TOOL_NAMES.LIST_DIR and go backwards to find the comment
  const listDirName = content.indexOf("name: BUILTIN_TOOL_NAMES.LIST_DIR");
  if (listDirName !== -1) {
    const previousRegister = content.lastIndexOf("this.register({", listDirName);
    const commentStart = content.lastIndexOf("/*", previousRegister);
    
    if (commentStart !== -1) {
       content = content.substring(0, commentStart) + replacementBlock + "\n\n    " + content.substring(commentStart);
       fs.writeFileSync(file, content);
       console.log("Inserted using fallback method.");
    } else {
       console.log("Failed to find comment start.");
    }
  } else {
    console.log("Failed to find list_dir");
  }
}
