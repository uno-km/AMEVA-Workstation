const fs = require('fs');

const file = 'packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts';
let content = fs.readFileSync(file, 'utf8');

// Add artifactManager to properties and constructor
content = content.replace(
  /private readonly fileAdapter\?: import\('\.\/task-runtime\/artifact\/IFileSystemAdapter'\)\.IFileSystemAdapter/,
  `private readonly fileAdapter?: import('./task-runtime/artifact/IFileSystemAdapter').IFileSystemAdapter\n  private readonly artifactManager?: import('./task-runtime/artifact/ArtifactTransactionManager').ArtifactTransactionManager`
);

content = content.replace(
  /constructor\(fileAdapter\?: import\('\.\/task-runtime\/artifact\/IFileSystemAdapter'\)\.IFileSystemAdapter\) {/,
  `constructor(fileAdapter?: import('./task-runtime/artifact/IFileSystemAdapter').IFileSystemAdapter, artifactManager?: import('./task-runtime/artifact/ArtifactTransactionManager').ArtifactTransactionManager) {\n    this.artifactManager = artifactManager;`
);

fs.writeFileSync(file, content);
console.log("Updated constructor in ToolRegistry.ts");
