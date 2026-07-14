const fs = require('fs');

const oldFile = 'clean_old_ToolRegistry.ts';
const newFile = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';

let content = fs.readFileSync(oldFile, 'utf8');

content = content.replace(/\\r\\n/g, '\\n');

content = content.replace(
  /private readonly fileAdapter\?: import\('\\.\/task-runtime\/artifact\/IFileSystemAdapter'\)\.IFileSystemAdapter/,
  "private readonly fileAdapter?: import('./task-runtime/artifact/IFileSystemAdapter').IFileSystemAdapter\n  private readonly artifactManager?: import('./task-runtime/artifact/ArtifactTransactionManager').ArtifactTransactionManager"
);

content = content.replace(
  /constructor\(fileAdapter\?: import\('\\.\/task-runtime\/artifact\/IFileSystemAdapter'\)\.IFileSystemAdapter\) \{/,
  "constructor(fileAdapter?: import('./task-runtime/artifact/IFileSystemAdapter').IFileSystemAdapter, artifactManager?: import('./task-runtime/artifact/ArtifactTransactionManager').ArtifactTransactionManager) {\n    this.fileAdapter = fileAdapter;\n    this.artifactManager = artifactManager;"
);

const listDirSearchRegex = /\\s*const path = args\['path'\] \? "[^"]*" : '.'\\s*try \{\\s*const result = await executeTerminal\([^)]+\)\\s*return \{\\s*success: true,\\s*result: result\.stdout \|\| '\(디렉토리가 비어있습니다\)',/;

const listDirReplace = "        const path = args['path'] ? String(args['path']) : '.'\n" +
"        \n" +
"        if (!this.fileAdapter) {\n" +
"          return {\n" +
"            success: false,\n" +
"            error: \"fileAdapter is not initialized. Cannot list directory.\",\n" +
"            toolName: BUILTIN_TOOL_NAMES.LIST_DIR,\n" +
"            toolArgs: args\n" +
"          };\n" +
"        }\n" +
"\n" +
"        try {\n" +
"          const result = await this.fileAdapter.list(path);\n" +
"          return {\n" +
"            success: true,\n" +
"            result: result || '(디렉토리가 비어있습니다)',";

content = content.replace(listDirSearchRegex, '\\n' + listDirReplace);

const listDirCommentIdx = content.indexOf("    /*\n     * [TOOL: list_dir]");
const replacementBlock = fs.readFileSync('block.txt', 'utf8').replace(/\\r\\n/g, '\\n');

if (listDirCommentIdx !== -1) {
    content = content.substring(0, listDirCommentIdx) + replacementBlock + "\n\n" + content.substring(listDirCommentIdx);
    fs.writeFileSync(newFile, content);
    console.log("Successfully rebuilt ToolRegistry.ts!");
} else {
    console.log("Failed to find list_dir comment");
}
